/* ================================================================
   PI THINKING — Tool Bridge
   ================================================================
   Ponte entre as ferramentas existentes e o módulo do aluno.
   
   Responsabilidades:
   - Detectar se a ferramenta foi aberta em modo oficina
   - Exibir botão "Concluir e Enviar" flutuante
   - Coletar dados específicos de cada ferramenta
   - Enviar dados ao Firebase via PISync
   - Redirecionar de volta ao aluno.html
   
   Como usar:
   Adicionar antes de </body> em cada ferramenta:
   
   <script src="https://www.gstatic.com/firebasejs/9.23.0/firebase-app-compat.js"></script>
   <script src="https://www.gstatic.com/firebasejs/9.23.0/firebase-database-compat.js"></script>
   <script src="js/firebase-config.js"></script>
   <script src="js/sync.js"></script>
   <script src="js/tool-bridge.js"></script>
   
   ================================================================ */

var ToolBridge = (function () {
    'use strict';

    var toolId = null;
    var isOfficeMode = false;
    var buttonCreated = false;
    var confirmOverlayCreated = false;

    /* ══════════════════════════════════════
       DETECÇÃO DE MODO
       ══════════════════════════════════════ */

    function detect() {
        var params = new URLSearchParams(window.location.search);
        isOfficeMode = params.get('modo') === 'oficina';
        toolId = params.get('tool') || null;

        if (!isOfficeMode || !toolId) return false;

        // Conectar ao Firebase e restaurar sessão
        if (typeof PISync !== 'undefined' && typeof FIREBASE_CONFIG !== 'undefined') {
            PISync.init(FIREBASE_CONFIG).then(function () {
                PISync.restoreSession();
            }).catch(function () {
                console.warn('[ToolBridge] Firebase indisponível. Modo offline.');
            });
        }

        return true;
    }

    /* ══════════════════════════════════════
       COLETORES DE DADOS POR FERRAMENTA
       ══════════════════════════════════════ */

    var collectors = {

        /* ── Quiz Diagnóstico ── */
        'quiz-diagnostico': function () {
            var data = {
                tipo: 'quiz',
                concluido: true
            };

            // Tentar capturar do estado global do quiz
            if (typeof score !== 'undefined' && typeof questions !== 'undefined') {
                data.score = score;
                data.total = questions.length;
                data.codigo = 'D-' + score;
            }

            // Tentar capturar do localStorage
            var saved = safeParseJSON(localStorage.getItem('pi-progress-quiz-diagnostico'));
            if (saved) {
                data.score = saved.score || data.score || 0;
                data.total = saved.total || data.total || 10;
                data.codigo = saved.code || saved.codigo || data.codigo || 'D-0';
            }

            // Capturar respostas individuais
            if (typeof answers !== 'undefined' && typeof questions !== 'undefined') {
                data.respostas = [];
                questions.forEach(function (q, i) {
                    var selecionada = answers[q.id] || '';
                    data.respostas.push({
                        questao: q.id,
                        texto: truncate(q.question, 80),
                        selecionada: selecionada,
                        correta: q.correct,
                        acertou: selecionada === q.correct,
                        categoria: q.category || ''
                    });
                });

                // Calcular tempo se disponível
                data.tempo_segundos = 0;
            }

            return data;
        },

        /* ── Cartas Personas ── */
        'cartas-personas': function () {
            var data = {
                tipo: 'interativa',
                concluido: true
            };

            // Verificar se uma persona foi sorteada (grid com 1 card)
            var grid = document.getElementById('cardsGrid');
            if (grid) {
                var cards = grid.querySelectorAll('.p-card-wrapper');
                if (cards.length === 1) {
                    var nameEl = cards[0].querySelector('.p-card__name');
                    if (nameEl) data.persona_sorteada = nameEl.textContent;
                } else {
                    data.persona_sorteada = 'Visualizou todas';
                }
            }

            return data;
        },

        /* ── Mapa de Empatia ── */
        'mapa-empatia': function () {
            var data = {
                tipo: 'canvas',
                concluido: true
            };

            // Capturar campos de objetivo
            var goalWho = document.getElementById('goalWho');
            var goalWhat = document.getElementById('goalWhat');
            if (goalWho) data.goal_who = goalWho.value || '';
            if (goalWhat) data.goal_what = goalWhat.value || '';

            // Capturar notas de cada quadrante
            var sections = ['see', 'hear', 'say', 'think', 'pain', 'gain'];
            sections.forEach(function (s) {
                var container = document.getElementById('notes-' + s);
                if (container) {
                    var noteEls = container.querySelectorAll('.m-canvas__note span');
                    var notas = [];
                    noteEls.forEach(function (el) {
                        var text = el.textContent.trim();
                        if (text) notas.push(text);
                    });
                    data['notas_' + s] = notas;
                }
            });

            data.total_notas = countTotalNotes(data, sections);
            return data;
        },

        /* ── Canvas de Diagnóstico ── */
        'canvas-diagnostico': function () {
            var data = {
                tipo: 'canvas',
                concluido: true
            };

            // Capturar todos os campos de texto
            for (var i = 1; i <= 8; i++) {
                var el = document.getElementById('diag-field-' + i);
                if (el) data['campo_' + i] = el.value || '';
            }

            // Capturar TRL
            var trlSlider = document.getElementById('trlSlider');
            if (trlSlider) data.trl = parseInt(trlSlider.value) || 1;

            // Capturar tipos de proteção selecionados
            var tipos = [];
            document.querySelectorAll('.d-protection__option.selected').forEach(function (el) {
                tipos.push(el.getAttribute('data-value'));
            });
            data.tipos_pi = tipos;

            return data;
        },

        /* ── Linha do Tempo ── */
        'linha-do-tempo': function () {
            var data = {
                tipo: 'interativa',
                concluido: true
            };

            // Contar eventos expandidos (lidos pelo aluno)
            var expandidos = document.querySelectorAll('.t-event__card.expanded');
            data.eventos_lidos = expandidos.length;
            data.total_eventos = document.querySelectorAll('.t-event__card').length;

            return data;
        },

        /* ── Árvore de Decisão ── */
        'arvore': function () {
            var data = {
                tipo: 'interativa',
                concluido: true
            };

            // Tentar capturar o resultado exibido
            var resultTitle = document.querySelector('.result-card h2');
            if (resultTitle) {
                data.resultado = resultTitle.textContent;
            }

            return data;
        },

        /* ── Crazy 8s ── */
        'crazy8s': function () {
            var data = {
                tipo: 'canvas',
                concluido: true
            };

            // Capturar cenário selecionado
            var cenarioSelect = document.getElementById('scenarioSelect');
            if (cenarioSelect) data.cenario = cenarioSelect.value || 'personalizado';

            // Capturar as 8 ideias
            data.ideias = [];
            for (var i = 0; i < 8; i++) {
                var ideaEl = document.getElementById('idea-' + i);
                if (ideaEl && ideaEl.value.trim()) {
                    data.ideias.push(ideaEl.value.trim());
                }
            }

            // Capturar votos
            if (typeof votes !== 'undefined') {
                data.votos = votes.slice();
            }

            data.total_ideias = data.ideias.length;
            return data;
        },

        /* ── Storyboard ── */
        'storyboard': function () {
            var data = {
                tipo: 'canvas',
                concluido: true
            };

            // Capturar cenas
            for (var i = 1; i <= 6; i++) {
                var actionEl = document.getElementById('action-' + i);
                var narrationEl = document.getElementById('narration-' + i);
                if (actionEl) data['cena_' + i + '_acao'] = actionEl.value || '';
                if (narrationEl) data['cena_' + i + '_narracao'] = narrationEl.value || '';
            }

            // Contar cenas preenchidas
            var preenchidas = 0;
            for (var j = 1; j <= 6; j++) {
                if (data['cena_' + j + '_acao'] || data['cena_' + j + '_narracao']) preenchidas++;
            }
            data.cenas_preenchidas = preenchidas;

            return data;
        },

        /* ── Canvas de Estratégia ── */
        'canvas-estrategia': function () {
            var data = {
                tipo: 'canvas',
                concluido: true
            };

            // Campo 1: Criação
            var creation = document.getElementById('field-creation');
            if (creation) data.criacao = creation.value || '';

            // Campo 2: Tipos de proteção
            var typeMain = document.getElementById('field-type-main');
            var typeComp = document.getElementById('field-type-complement');
            if (typeMain) data.tipo_principal = typeMain.value || '';
            if (typeComp) data.tipo_complementar = typeComp.value || '';

            // Campo 8: Stakeholders
            var stakeholders = document.getElementById('field-stakeholders');
            if (stakeholders) data.stakeholders = stakeholders.value || '';

            // Campo 9: Riscos
            var risks = document.getElementById('field-risks');
            if (risks) data.riscos = risks.value || '';

            // Campo 10: Ações
            data.acoes = [];
            document.querySelectorAll('.ce-action-row').forEach(function (row) {
                var inputs = row.querySelectorAll('input');
                if (inputs.length >= 3 && inputs[0].value.trim()) {
                    data.acoes.push({
                        acao: inputs[0].value.trim(),
                        responsavel: inputs[1].value.trim(),
                        prazo: inputs[2].value.trim()
                    });
                }
            });

            return data;
        },

        /* ── Simulador de Depósito ── */
        'simulador-deposito': function () {
            var data = {
                tipo: 'interativa',
                concluido: true
            };

            var tipoSelect = document.getElementById('tipoProtecao');
            var descontoSelect = document.getElementById('desconto');
            if (tipoSelect) data.tipo_selecionado = tipoSelect.value || '';
            if (descontoSelect) data.com_desconto = descontoSelect.value === 'desconto';

            return data;
        },

        /* ── Baralho de Dilemas ── */
        'baralho-dilemas': function () {
            var data = {
                tipo: 'interativa',
                concluido: true
            };

            // Contar dilemas discutidos
            var doneButtons = document.querySelectorAll('.bd-card__discussed-btn.done');
            data.dilemas_discutidos = doneButtons.length;
            data.total_dilemas = typeof dilemmas !== 'undefined' ? dilemmas.length : 16;

            // Capturar notas dos dilemas
            data.notas = {};
            if (typeof dilemmas !== 'undefined') {
                dilemmas.forEach(function (d) {
                    var noteEl = document.getElementById('note-' + d.id);
                    if (noteEl && noteEl.value.trim()) {
                        data.notas[d.id] = {
                            titulo: d.title,
                            nota: noteEl.value.trim()
                        };
                    }
                });
            }

            return data;
        },

        /* ── Escape Room ── */
        'escape-room': function () {
            var data = {
                tipo: 'jogo',
                concluido: true
            };

            if (typeof score !== 'undefined') data.score = score;
            if (typeof totalHints !== 'undefined') data.dicas_usadas = totalHints;
            if (typeof timerSeconds !== 'undefined') data.tempo_restante = timerSeconds;
            if (typeof answeredPuzzles !== 'undefined') {
                data.puzzles_corretos = 0;
                data.puzzles_total = typeof puzzles !== 'undefined' ? puzzles.length : 8;
                Object.keys(answeredPuzzles).forEach(function (key) {
                    var puzzle = null;
                    if (typeof puzzles !== 'undefined') {
                        puzzle = puzzles.find(function (p) { return String(p.id) === String(key); });
                    }
                    if (puzzle && answeredPuzzles[key] === puzzle.correct) {
                        data.puzzles_corretos++;
                    }
                });
            }

            // Score máximo
            if (typeof puzzles !== 'undefined') {
                data.max_score = 0;
                puzzles.forEach(function (p) { data.max_score += p.points; });
            }

            return data;
        },

        /* ── PI Quest ── */
        'pi-quest': function () {
            var data = {
                tipo: 'jogo',
                concluido: true
            };

            if (typeof score !== 'undefined') data.score = score;
            if (typeof inventory !== 'undefined') data.inventario = inventory.slice();
            if (typeof decisions !== 'undefined') data.decisoes = decisions.slice();
            if (typeof story !== 'undefined') {
                data.cenas_total = story.length;
                data.max_score = 0;
                story.forEach(function (s) {
                    var best = 0;
                    s.choices.forEach(function (c) { if (c.points > best) best = c.points; });
                    data.max_score += best;
                });
            }

            return data;
        },

        /* ── Quiz Final ── */
        'quiz-final': function () {
            var data = {
                tipo: 'quiz',
                concluido: true
            };

            // Tentar capturar das variáveis globais
            if (typeof correctCount !== 'undefined') data.score = correctCount;
            if (typeof questions !== 'undefined') data.total = questions.length;
            if (typeof quizMode !== 'undefined') data.modo = quizMode;

            // Código F-X
            data.codigo = 'F-' + (data.score || 0);

            // Capturar respostas individuais
            if (typeof answers !== 'undefined' && typeof questions !== 'undefined') {
                data.respostas = [];
                questions.forEach(function (q) {
                    var answer = answers[q.id];
                    data.respostas.push({
                        questao: q.id,
                        texto: truncate(q.text || q.question || '', 80),
                        selecionada: answer ? answer.selected : '',
                        correta: q.correct,
                        acertou: answer ? answer.correct : false,
                        fase: q.phase || ''
                    });
                });
            }

            // Tempo
            if (typeof timerSeconds !== 'undefined' && typeof quizMode !== 'undefined') {
                if (quizMode === 'timed') {
                    data.tempo_segundos = 1800 - timerSeconds;
                }
            }

            return data;
        },

        /* ── Canvas de Avaliação ── */
        'canvas-avaliacao': function () {
            var data = {
                tipo: 'canvas',
                concluido: true
            };

            // Capturar estrelas por fase
            if (typeof ratings !== 'undefined') {
                data.estrelas = {};
                Object.keys(ratings).forEach(function (key) {
                    data.estrelas[key] = ratings[key];
                });
            }

            // Capturar comentários por fase
            if (typeof comments !== 'undefined') {
                data.comentarios = {};
                Object.keys(comments).forEach(function (key) {
                    if (comments[key]) data.comentarios[key] = comments[key];
                });
            }

            // Capturar avaliação geral
            var fields = ['genStrengths', 'genImprovements', 'genLearning', 'genNextSteps'];
            var labels = ['pontos_fortes', 'melhorias', 'aprendizado', 'proximos_passos'];
            data.geral = {};
            fields.forEach(function (fieldId, i) {
                var el = document.getElementById(fieldId);
                if (el && el.value.trim()) {
                    data.geral[labels[i]] = el.value.trim();
                }
            });

            // Calcular média
            if (data.estrelas) {
                var total = 0;
                var count = 0;
                Object.values(data.estrelas).forEach(function (v) {
                    if (v > 0) { total += v; count++; }
                });
                data.media_estrelas = count > 0 ? parseFloat((total / count).toFixed(1)) : 0;
            }

            return data;
        }
    };

    /* ══════════════════════════════════════
       COLETOR GENÉRICO (FALLBACK)
       ══════════════════════════════════════ */

    function collectGeneric() {
        return {
            tipo: 'generico',
            concluido: true,
            ferramenta: toolId
        };
    }

    /* ══════════════════════════════════════
       INTERFACE — BOTÃO E OVERLAY
       ══════════════════════════════════════ */

    function createButton() {
        if (buttonCreated) return;
        buttonCreated = true;

        var btn = document.createElement('button');
        btn.id = 'toolBridgeBtn';
        btn.innerHTML = '✅ <span>Concluir e Enviar</span>';
        btn.setAttribute('aria-label', 'Marcar atividade como concluída e enviar dados ao facilitador');

        btn.style.cssText =
            'position:fixed; bottom:1.5rem; left:50%; transform:translateX(-50%);' +
            'padding:14px 32px; background:#16A34A; color:#fff; border:none;' +
            'border-radius:30px; font-family:Poppins,sans-serif; font-size:1rem;' +
            'font-weight:700; cursor:pointer; z-index:99998;' +
            'box-shadow:0 4px 20px rgba(22,163,74,.35);' +
            'display:flex; align-items:center; gap:8px;' +
            'transition:all .2s cubic-bezier(.4,0,.2,1);';

        btn.onmouseenter = function () {
            btn.style.transform = 'translateX(-50%) translateY(-3px)';
            btn.style.boxShadow = '0 8px 28px rgba(22,163,74,.4)';
        };
        btn.onmouseleave = function () {
            btn.style.transform = 'translateX(-50%)';
            btn.style.boxShadow = '0 4px 20px rgba(22,163,74,.35)';
        };

        btn.onclick = handleCompletion;
        document.body.appendChild(btn);

        // Também criar barra de contexto no topo
        createContextBar();
    }

    function createContextBar() {
        var info = {};
        if (typeof PISync !== 'undefined') {
            info = PISync.getSessionInfo();
        } else {
            info.participantName = localStorage.getItem('pi-participant-name') || '';
            info.sessionId = localStorage.getItem('pi-session-id') || '';
        }

        var bar = document.createElement('div');
        bar.style.cssText =
            'position:fixed; top:0; left:0; right:0; z-index:99997;' +
            'background:linear-gradient(90deg,#4361EE,#7209B7); color:#fff;' +
            'padding:6px 16px; font-family:Inter,sans-serif; font-size:.78rem;' +
            'display:flex; align-items:center; justify-content:space-between;' +
            'font-weight:500;';

        bar.innerHTML =
            '<span>🧠 PI Thinking · Modo Oficina</span>' +
            '<span>' + (info.participantName || '') + ' · ' + (info.sessionId || '') + '</span>';

        document.body.appendChild(bar);

        // Empurrar conteúdo para baixo
        document.body.style.paddingTop =
            (parseInt(window.getComputedStyle(document.body).paddingTop) || 0) + 32 + 'px';
    }

    function showConfirmOverlay(data, sendingCallback) {
        if (confirmOverlayCreated) return;
        confirmOverlayCreated = true;

        var overlay = document.createElement('div');
        overlay.id = 'toolBridgeOverlay';
        overlay.style.cssText =
            'position:fixed; inset:0; background:rgba(0,0,0,.8); z-index:99999;' +
            'display:flex; align-items:center; justify-content:center; padding:2rem;';

        var card = document.createElement('div');
        card.style.cssText =
            'background:#fff; border-radius:16px; padding:2.5rem; max-width:420px;' +
            'width:100%; text-align:center; animation:fadeIn .3s ease;';

        card.innerHTML =
            '<div style="font-size:3rem;margin-bottom:.5rem;">📤</div>' +
            '<h2 style="font-family:Poppins,sans-serif;font-size:1.3rem;font-weight:700;' +
                'color:#1E293B;margin-bottom:.3rem;">Enviando dados...</h2>' +
            '<p id="bridgeStatus" style="font-size:.92rem;color:#64748B;margin-bottom:1.5rem;">' +
                'Aguarde enquanto seus dados são enviados ao facilitador.</p>' +
            '<div id="bridgeSpinner" style="margin-bottom:1rem;">' +
                '<div style="width:40px;height:40px;border:4px solid #E2E8F0;' +
                    'border-top-color:#4361EE;border-radius:50%;margin:0 auto;' +
                    'animation:spin .8s linear infinite;"></div>' +
            '</div>' +
            '<button id="bridgeContinue" style="display:none;padding:12px 32px;' +
                'background:#16A34A;color:#fff;border:none;border-radius:8px;' +
                'font-family:Poppins,sans-serif;font-size:1rem;font-weight:700;' +
                'cursor:pointer;transition:all .2s;">→ Próxima Atividade</button>';

        overlay.appendChild(card);
        document.body.appendChild(overlay);

        // Adicionar keyframe de spin se não existir
        if (!document.getElementById('bridgeSpinStyle')) {
            var style = document.createElement('style');
            style.id = 'bridgeSpinStyle';
            style.textContent = '@keyframes spin{from{transform:rotate(0deg)}to{transform:rotate(360deg)}}' +
                '@keyframes fadeIn{from{opacity:0;transform:translateY(10px)}to{opacity:1;transform:translateY(0)}}';
            document.head.appendChild(style);
        }

        // Executar envio
        sendingCallback(function (success) {
            var statusEl = document.getElementById('bridgeStatus');
            var spinnerEl = document.getElementById('bridgeSpinner');
            var continueBtn = document.getElementById('bridgeContinue');

            spinnerEl.style.display = 'none';
            continueBtn.style.display = 'inline-block';

            if (success) {
                statusEl.innerHTML = '✅ Dados enviados com sucesso!<br>' +
                    '<span style="font-size:.82rem;color:#94A3B8;">O facilitador já pode ver seu progresso.</span>';
                card.querySelector('div').textContent = '✅';
                card.querySelector('h2').textContent = 'Atividade Concluída!';
                card.querySelector('h2').style.color = '#16A34A';
            } else {
                statusEl.innerHTML = '⚠️ Dados salvos localmente.<br>' +
                    '<span style="font-size:.82rem;color:#94A3B8;">Sem conexão com o servidor. Seu progresso foi salvo no dispositivo.</span>';
                card.querySelector('div').textContent = '💾';
                card.querySelector('h2').textContent = 'Salvo Localmente';
                card.querySelector('h2').style.color = '#EA580C';
            }

            continueBtn.onclick = function () {
                window.location.href = 'aluno.html?completed=' + toolId;
            };
        });
    }

    /* ══════════════════════════════════════
       HANDLER DE CONCLUSÃO
       ══════════════════════════════════════ */

    function handleCompletion() {
        // Remover botão
        var btn = document.getElementById('toolBridgeBtn');
        if (btn) btn.remove();

        // Coletar dados
        var collector = collectors[toolId] || collectGeneric;
        var data = collector();

        // Mostrar overlay e enviar
        showConfirmOverlay(data, function (onComplete) {

            // Enviar via PISync
            if (typeof PISync !== 'undefined' && PISync.isOnline() && PISync.isInSession()) {

                // Se for quiz, enviar também no nó especial de ranking
                var quizPromise = Promise.resolve();
                if (toolId === 'quiz-diagnostico' && data.score !== undefined) {
                    quizPromise = PISync.sendQuizResult('diagnostico', {
                        score: data.score,
                        total: data.total,
                        codigo: data.codigo,
                        tempo_segundos: data.tempo_segundos || 0,
                        respostas: data.respostas || []
                    });
                } else if (toolId === 'quiz-final' && data.score !== undefined) {
                    quizPromise = PISync.sendQuizResult('final', {
                        score: data.score,
                        total: data.total,
                        codigo: data.codigo,
                        tempo_segundos: data.tempo_segundos || 0,
                        respostas: data.respostas || []
                    });
                }

                // Enviar ferramenta completa
                var toolPromise = PISync.sendToolCompletion(toolId, data);

                Promise.all([quizPromise, toolPromise]).then(function () {
                    onComplete(true);
                }).catch(function () {
                    onComplete(false);
                });

            } else {
                // Offline — salvar localmente
                var completed = safeParseJSON(localStorage.getItem('pi-completed-tools')) || {};
                completed[toolId] = {
                    concluido: true,
                    em: new Date().toISOString(),
                    dados: data
                };
                localStorage.setItem('pi-completed-tools', JSON.stringify(completed));
                onComplete(false);
            }
        });
    }

    /* ══════════════════════════════════════
       UTILITÁRIOS
       ══════════════════════════════════════ */

    function safeParseJSON(str) {
        if (!str) return null;
        try { return JSON.parse(str); } catch (e) { return null; }
    }

    function truncate(str, max) {
        if (!str) return '';
        return str.length > max ? str.substring(0, max) + '…' : str;
    }

    function countTotalNotes(data, sections) {
        var total = 0;
        sections.forEach(function (s) {
            if (data['notas_' + s] && Array.isArray(data['notas_' + s])) {
                total += data['notas_' + s].length;
            }
        });
        return total;
    }

    /* ══════════════════════════════════════
       INICIALIZAÇÃO AUTOMÁTICA
       ══════════════════════════════════════ */

    function boot() {
        if (detect()) {
            // Aguardar o DOM estar pronto
            if (document.readyState === 'loading') {
                document.addEventListener('DOMContentLoaded', createButton);
            } else {
                // Pequeno delay para garantir que scripts da ferramenta carregaram
                setTimeout(createButton, 500);
            }
        }
    }

    // Auto-executar
    boot();

    /* ══════════════════════════════════════
       API PÚBLICA (para uso avançado)
       ══════════════════════════════════════ */

    return {
        isOfficeMode: function () { return isOfficeMode; },
        getToolId: function () { return toolId; },
        triggerCompletion: handleCompletion
    };

})();
