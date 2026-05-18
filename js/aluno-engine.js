/* ================================================================
   PI THINKING — Aluno Engine
   ================================================================
   Responsabilidades:
   - Definir os percursos (2h, 3h, 4h) com ferramentas ordenadas
   - Controlar progressão (desbloqueio por conclusão)
   - Integrar com controles do facilitador (desbloqueio remoto)
   - Fornecer estado completo para renderização da UI
   
   Dependências:
   - js/sync.js (para leitura de controles do facilitador)
   ================================================================ */

var AlunoEngine = (function () {
    'use strict';

    /* ══════════════════════════════════════
       DEFINIÇÃO DOS PERCURSOS
       ══════════════════════════════════════ */

    var PERCURSOS = {
        '2h': {
            nome: 'Compacto',
            descricao: '8 ferramentas essenciais — 2 horas',
            ferramentas: [
                { id: 'quiz-diagnostico',   nome: 'Quiz Diagnóstico',      fase: 1, tipo: 'essencial',    url: 'quiz-diagnostico.html',   icone: '📋', duracao: '10 min' },
                { id: 'cartas-personas',     nome: 'Cartas Personas',       fase: 1, tipo: 'essencial',    url: 'cartas-personas.html',    icone: '🃏', duracao: '10 min' },
                { id: 'canvas-diagnostico',  nome: 'Canvas de Diagnóstico', fase: 2, tipo: 'essencial',    url: 'canvas-diagnostico.html', icone: '📐', duracao: '15 min' },
                { id: 'arvore',              nome: 'Árvore de Decisão',     fase: 2, tipo: 'essencial',    url: 'arvore.html',             icone: '🌳', duracao: '10 min' },
                { id: 'canvas-estrategia',   nome: 'Canvas de Estratégia',  fase: 3, tipo: 'essencial',    url: 'canvas-estrategia.html',  icone: '📐', duracao: '15 min' },
                { id: 'simulador-deposito',  nome: 'Simulador de Depósito', fase: 4, tipo: 'essencial',    url: 'simulador-deposito.html', icone: '📝', duracao: '20 min' },
                { id: 'baralho-dilemas',     nome: 'Baralho de Dilemas',    fase: 4, tipo: 'essencial',    url: 'baralho-dilemas.html',    icone: '🃏', duracao: '10 min' },
                { id: 'quiz-final',          nome: 'Quiz Final',            fase: 5, tipo: 'essencial',    url: 'quiz-final.html',         icone: '🏆', duracao: '15 min' }
            ]
        },
        '3h': {
            nome: 'Padrão',
            descricao: '12 ferramentas (essenciais + recomendadas) — 3 horas',
            ferramentas: [
                { id: 'quiz-diagnostico',   nome: 'Quiz Diagnóstico',      fase: 1, tipo: 'essencial',    url: 'quiz-diagnostico.html',   icone: '📋', duracao: '10 min' },
                { id: 'cartas-personas',     nome: 'Cartas Personas',       fase: 1, tipo: 'essencial',    url: 'cartas-personas.html',    icone: '🃏', duracao: '15 min' },
                { id: 'mapa-empatia',        nome: 'Mapa de Empatia',       fase: 1, tipo: 'recomendada',  url: 'mapa-empatia.html',       icone: '🗺️', duracao: '15 min' },
                { id: 'canvas-diagnostico',  nome: 'Canvas de Diagnóstico', fase: 2, tipo: 'essencial',    url: 'canvas-diagnostico.html', icone: '📐', duracao: '15 min' },
                { id: 'arvore',              nome: 'Árvore de Decisão',     fase: 2, tipo: 'essencial',    url: 'arvore.html',             icone: '🌳', duracao: '10 min' },
                { id: 'crazy8s',             nome: 'Crazy 8s da PI',        fase: 3, tipo: 'recomendada',  url: 'crazy8s.html',            icone: '⚡', duracao: '15 min' },
                { id: 'canvas-estrategia',   nome: 'Canvas de Estratégia',  fase: 3, tipo: 'essencial',    url: 'canvas-estrategia.html',  icone: '📐', duracao: '15 min' },
                { id: 'storyboard',          nome: 'Storyboard',            fase: 3, tipo: 'recomendada',  url: 'storyboard.html',         icone: '🎬', duracao: '15 min' },
                { id: 'simulador-deposito',  nome: 'Simulador de Depósito', fase: 4, tipo: 'essencial',    url: 'simulador-deposito.html', icone: '📝', duracao: '20 min' },
                { id: 'baralho-dilemas',     nome: 'Baralho de Dilemas',    fase: 4, tipo: 'essencial',    url: 'baralho-dilemas.html',    icone: '🃏', duracao: '15 min' },
                { id: 'quiz-final',          nome: 'Quiz Final',            fase: 5, tipo: 'essencial',    url: 'quiz-final.html',         icone: '🏆', duracao: '10 min' },
                { id: 'canvas-avaliacao',    nome: 'Canvas de Avaliação',   fase: 5, tipo: 'recomendada',  url: 'canvas-avaliacao.html',   icone: '📊', duracao: '10 min' }
            ]
        },
        '4h': {
            nome: 'Completo',
            descricao: 'Todas as 16 ferramentas — 4 horas',
            ferramentas: [
                { id: 'quiz-diagnostico',   nome: 'Quiz Diagnóstico',      fase: 1, tipo: 'essencial',    url: 'quiz-diagnostico.html',   icone: '📋', duracao: '15 min' },
                { id: 'cartas-personas',     nome: 'Cartas Personas',       fase: 1, tipo: 'essencial',    url: 'cartas-personas.html',    icone: '🃏', duracao: '15 min' },
                { id: 'mapa-empatia',        nome: 'Mapa de Empatia',       fase: 1, tipo: 'recomendada',  url: 'mapa-empatia.html',       icone: '🗺️', duracao: '15 min' },
                { id: 'canvas-diagnostico',  nome: 'Canvas de Diagnóstico', fase: 2, tipo: 'essencial',    url: 'canvas-diagnostico.html', icone: '📐', duracao: '15 min' },
                { id: 'linha-do-tempo',      nome: 'Linha do Tempo',        fase: 2, tipo: 'opcional',     url: 'linha-do-tempo.html',     icone: '📅', duracao: '10 min' },
                { id: 'arvore',              nome: 'Árvore de Decisão',     fase: 2, tipo: 'essencial',    url: 'arvore.html',             icone: '🌳', duracao: '15 min' },
                { id: 'crazy8s',             nome: 'Crazy 8s da PI',        fase: 3, tipo: 'recomendada',  url: 'crazy8s.html',            icone: '⚡', duracao: '15 min' },
                { id: 'storyboard',          nome: 'Storyboard',            fase: 3, tipo: 'recomendada',  url: 'storyboard.html',         icone: '🎬', duracao: '15 min' },
                { id: 'canvas-estrategia',   nome: 'Canvas de Estratégia',  fase: 3, tipo: 'essencial',    url: 'canvas-estrategia.html',  icone: '📐', duracao: '15 min' },
                { id: 'simulador-deposito',  nome: 'Simulador de Depósito', fase: 4, tipo: 'essencial',    url: 'simulador-deposito.html', icone: '📝', duracao: '30 min' },
                { id: 'baralho-dilemas',     nome: 'Baralho de Dilemas',    fase: 4, tipo: 'essencial',    url: 'baralho-dilemas.html',    icone: '🃏', duracao: '15 min' },
                { id: 'escape-room',         nome: 'Escape Room',           fase: 4, tipo: 'opcional',     url: 'escape-room.html',        icone: '🔐', duracao: '15 min' },
                { id: 'pi-quest',            nome: 'PI Quest',              fase: 5, tipo: 'opcional',     url: 'pi-quest.html',           icone: '🎲', duracao: '15 min' },
                { id: 'quiz-final',          nome: 'Quiz Final',            fase: 5, tipo: 'essencial',    url: 'quiz-final.html',         icone: '🏆', duracao: '15 min' },
                { id: 'canvas-avaliacao',    nome: 'Canvas de Avaliação',   fase: 5, tipo: 'recomendada',  url: 'canvas-avaliacao.html',   icone: '📊', duracao: '10 min' }
            ]
        }
    };

    var FASES = [
        { num: 1, nome: 'Descobrir',    icone: '🧠', cor: '#E91E63' },
        { num: 2, nome: 'Diagnosticar', icone: '🔍', cor: '#FF9800' },
        { num: 3, nome: 'Estrategar',   icone: '🚀', cor: '#2196F3' },
        { num: 4, nome: 'Prototipar',   icone: '🛠️', cor: '#9C27B0' },
        { num: 5, nome: 'Evoluir',      icone: '📈', cor: '#4CAF50' }
    ];

    var APOIO = [
        { id: 'glossario',    nome: 'Glossário Dinâmico',      url: 'glossario.html',    icone: '📖' },
        { id: 'calculadora',  nome: 'Calculadora de Vigência',  url: 'calculadora.html',  icone: '📅' },
        { id: 'busca',        nome: 'Busca de Anterioridade',   url: 'busca.html',        icone: '🔍' }
    ];

    /* ── Estado ── */
    var currentPercurso = null;
    var currentPercursoKey = null;
    var completedTools = {};
    var facilitatorControls = {
        fases_liberadas: [1],
        ferramentas_liberadas: []
    };

    /* ══════════════════════════════════════
       INICIALIZAÇÃO E RESTAURAÇÃO
       ══════════════════════════════════════ */

    /**
     * Inicializa com um percurso específico.
     * @param {string} percursoKey - "2h", "3h" ou "4h"
     * @returns {Object|null} O percurso ou null se inválido
     */
    function init(percursoKey) {
        if (!PERCURSOS[percursoKey]) {
            console.error('[AlunoEngine] Percurso inválido:', percursoKey);
            return null;
        }

        currentPercursoKey = percursoKey;
        currentPercurso = PERCURSOS[percursoKey];
        localStorage.setItem('pi-percurso', percursoKey);

        // Carregar conclusões locais
        loadLocalCompletions();

        // Começar a escutar controles do facilitador
        startWatchingControls();

        return currentPercurso;
    }

    /**
     * Restaura sessão anterior.
     * @returns {Object|null}
     */
    function restore() {
        var key = localStorage.getItem('pi-percurso');
        if (key && PERCURSOS[key]) {
            return init(key);
        }
        return null;
    }

    /* ══════════════════════════════════════
       CONTROLE DE PROGRESSÃO
       ══════════════════════════════════════ */

    /**
     * Marca ferramenta como concluída localmente.
     * O envio ao Firebase é feito pelo sync.js separadamente.
     * @param {string} toolId
     */
    function completeTool(toolId) {
        completedTools[toolId] = {
            concluido: true,
            em: new Date().toISOString()
        };
        saveLocalCompletions();
    }

    /**
     * Verifica se uma ferramenta está concluída.
     * @param {string} toolId
     * @returns {boolean}
     */
    function isCompleted(toolId) {
        return !!(completedTools[toolId] && completedTools[toolId].concluido);
    }

    /**
     * Verifica se uma ferramenta está desbloqueada.
     * Uma ferramenta é desbloqueada se:
     * 1) É a primeira do percurso, OU
     * 2) A ferramenta anterior foi concluída, OU
     * 3) A fase da ferramenta foi liberada pelo facilitador, OU
     * 4) A ferramenta específica foi liberada pelo facilitador
     * @param {number} toolIndex - Índice da ferramenta no percurso
     * @returns {boolean}
     */
    function isUnlocked(toolIndex) {
        if (!currentPercurso) return false;

        var tool = currentPercurso.ferramentas[toolIndex];
        if (!tool) return false;

        // Primeira ferramenta sempre desbloqueada
        if (toolIndex === 0) return true;

        // Ferramenta anterior concluída
        var prevTool = currentPercurso.ferramentas[toolIndex - 1];
        if (isCompleted(prevTool.id)) return true;

        // Fase liberada pelo facilitador
        if (facilitatorControls.fases_liberadas.indexOf(tool.fase) !== -1) {
            // Verificar se TODAS as ferramentas de fases ANTERIORES estão
            // concluídas OU se a fase anterior também está liberada
            var fasesAnteriores = [];
            for (var f = 1; f < tool.fase; f++) {
                fasesAnteriores.push(f);
            }
            var todasFasesAnterioresLiberadas = fasesAnteriores.every(function (fase) {
                return facilitatorControls.fases_liberadas.indexOf(fase) !== -1;
            });
            if (todasFasesAnterioresLiberadas) return true;
        }

        // Ferramenta específica liberada pelo facilitador
        if (facilitatorControls.ferramentas_liberadas.indexOf(tool.id) !== -1) {
            return true;
        }

        return false;
    }

    /* ══════════════════════════════════════
       CONTROLES DO FACILITADOR
       ══════════════════════════════════════ */

    /**
     * Inicia escuta dos controles do facilitador via Firebase.
     */
    function startWatchingControls() {
        if (typeof PISync !== 'undefined' && PISync.isInSession()) {
            PISync.watchControls(function (controls) {
                facilitatorControls = controls;
                // Disparar evento para que a UI atualize
                if (typeof window !== 'undefined') {
                    window.dispatchEvent(new CustomEvent('pi-controls-updated', {
                        detail: controls
                    }));
                }
            });
        }
    }

    /**
     * Para de escutar controles.
     */
    function stopWatchingControls() {
        if (typeof PISync !== 'undefined') {
            PISync.stopWatchingControls();
        }
    }

    /* ══════════════════════════════════════
       ESTADO PARA RENDERIZAÇÃO
       ══════════════════════════════════════ */

    /**
     * Retorna o estado completo do percurso para renderizar a UI.
     * @returns {Object|null}
     */
    function getState() {
        if (!currentPercurso) return null;

        var ferramentas = currentPercurso.ferramentas.map(function (f, i) {
            var concluida = isCompleted(f.id);
            var desbloqueada = isUnlocked(i);

            return {
                id: f.id,
                nome: f.nome,
                fase: f.fase,
                tipo: f.tipo,
                url: f.url,
                icone: f.icone,
                duracao: f.duracao,
                concluida: concluida,
                desbloqueada: desbloqueada,
                indice: i
            };
        });

        var totalConcluidas = ferramentas.filter(function (f) {
            return f.concluida;
        }).length;

        // Determinar fase atual
        var faseAtual = 1;
        for (var i = ferramentas.length - 1; i >= 0; i--) {
            if (ferramentas[i].concluida) {
                var nextIndex = i + 1;
                if (nextIndex < ferramentas.length) {
                    faseAtual = ferramentas[nextIndex].fase;
                } else {
                    faseAtual = 5;
                }
                break;
            }
        }

        // Próxima ferramenta a fazer
        var proximaFerramenta = null;
        for (var j = 0; j < ferramentas.length; j++) {
            if (!ferramentas[j].concluida && ferramentas[j].desbloqueada) {
                proximaFerramenta = ferramentas[j];
                break;
            }
        }

        return {
            percurso: currentPercurso.nome,
            percursoKey: currentPercursoKey,
            descricao: currentPercurso.descricao,
            ferramentas: ferramentas,
            fases: FASES,
            apoio: APOIO,
            totalFerramentas: ferramentas.length,
            totalConcluidas: totalConcluidas,
            progresso: Math.round((totalConcluidas / ferramentas.length) * 100),
            faseAtual: faseAtual,
            concluido: totalConcluidas === ferramentas.length,
            proximaFerramenta: proximaFerramenta,
            controlesDoFacilitador: facilitatorControls
        };
    }

    /* ══════════════════════════════════════
       PERSISTÊNCIA LOCAL
       ══════════════════════════════════════ */

    function loadLocalCompletions() {
        try {
            completedTools = JSON.parse(
                localStorage.getItem('pi-completed-tools') || '{}'
            );
        } catch (e) {
            completedTools = {};
        }

        // Também carregar do PISync se disponível
        if (typeof PISync !== 'undefined') {
            var syncCompletions = PISync.getLocalCompletions();
            Object.keys(syncCompletions).forEach(function (key) {
                if (!completedTools[key]) {
                    completedTools[key] = syncCompletions[key];
                }
            });
        }
    }

    function saveLocalCompletions() {
        localStorage.setItem('pi-completed-tools', JSON.stringify(completedTools));
    }

    /* ══════════════════════════════════════
       RESET
       ══════════════════════════════════════ */

    /**
     * Reseta todo o progresso do aluno.
     */
    function reset() {
        completedTools = {};
        currentPercurso = null;
        currentPercursoKey = null;
        facilitatorControls = { fases_liberadas: [1], ferramentas_liberadas: [] };
        localStorage.removeItem('pi-completed-tools');
        localStorage.removeItem('pi-percurso');
        stopWatchingControls();
    }

    /* ══════════════════════════════════════
       API PÚBLICA
       ══════════════════════════════════════ */

    return {
        // Constantes
        PERCURSOS: PERCURSOS,
        FASES: FASES,
        APOIO: APOIO,

        // Inicialização
        init: init,
        restore: restore,
        reset: reset,

        // Progressão
        completeTool: completeTool,
        isCompleted: isCompleted,
        isUnlocked: isUnlocked,

        // Estado
        getState: getState
    };

})();
