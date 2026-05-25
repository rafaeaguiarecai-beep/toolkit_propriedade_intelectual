/* ================================================================
   PI THINKING — Configuração Central de Fases e Ferramentas
   ================================================================
   Fonte única de verdade do kit de ferramentas.
   Compatível com páginas estruturais, módulo do aluno, dashboard,
   quizzes, ferramentas individuais e modo oficina.
   ================================================================ */

(function (global) {
    'use strict';

    var VERSION = '3.0.0';

    var FASES = [
        {
            id: 'descobrir',
            num: 1,
            nome: 'Descobrir',
            icone: '🧠',
            cor: '#4361EE',
            bloom: 'Lembrar, Compreender',
            pergunta: 'O que já sabemos sobre a criação, o contexto e as pessoas envolvidas?'
        },
        {
            id: 'diagnosticar',
            num: 2,
            nome: 'Diagnosticar',
            icone: '🔎',
            cor: '#7209B7',
            bloom: 'Compreender, Aplicar',
            pergunta: 'Qual é o problema de PI e quais evidências orientam a análise?'
        },
        {
            id: 'estrategar',
            num: 3,
            nome: 'Estrategar',
            icone: '🧭',
            cor: '#F72585',
            bloom: 'Aplicar, Analisar',
            pergunta: 'Quais rotas de proteção fazem mais sentido para esta criação?'
        },
        {
            id: 'testar',
            num: 4,
            nome: 'Testar',
            icone: '🧪',
            cor: '#FF6D00',
            bloom: 'Analisar, Avaliar',
            pergunta: 'Como validar a estratégia escolhida e antecipar decisões críticas?'
        },
        {
            id: 'evoluir',
            num: 5,
            nome: 'Evoluir',
            icone: '📈',
            cor: '#06D6A0',
            bloom: 'Avaliar, Criar',
            pergunta: 'O que foi aprendido e quais são os próximos passos após a oficina?'
        }
    ];

    var CLASSIFICACOES = {
        essencial: {
            id: 'essencial',
            sigla: 'E',
            rotulo: 'Essencial',
            descricao: 'Ferramenta central do percurso.'
        },
        recomendada: {
            id: 'recomendada',
            sigla: 'R',
            rotulo: 'Recomendada',
            descricao: 'Ferramenta complementar para aprofundamento.'
        },
        opcional: {
            id: 'opcional',
            sigla: 'O',
            rotulo: 'Opcional',
            descricao: 'Ferramenta adicional para oficinas ampliadas.'
        },
        apoio: {
            id: 'apoio',
            sigla: 'A',
            rotulo: 'Apoio',
            descricao: 'Ferramenta de consulta permanente.'
        },
        assincrona: {
            id: 'assincrona',
            sigla: 'PÓS',
            rotulo: 'Pós-oficina',
            descricao: 'Ferramenta liberada após a conclusão da oficina.'
        },
        legado: {
            id: 'legado',
            sigla: 'LEG',
            rotulo: 'Legado',
            descricao: 'Arquivo mantido por compatibilidade, fora do fluxo ativo.'
        }
    };

    var FERRAMENTAS = [
        {
            id: 'quiz-diagnostico',
            arquivo: 'quiz-diagnostico.html',
            nome: 'Quiz Diagnóstico',
            fase: 1,
            classificacao: 'essencial',
            icone: '📋',
            ativa: true,
            sincrona: true,
            apoio: false,
            ordemCompleta: 1,
            resumo: 'Diagnóstico inicial de conhecimentos prévios sobre PI.'
        },
        {
            id: 'cartas-personas',
            arquivo: 'cartas-personas.html',
            nome: 'Cartas Personas',
            fase: 1,
            classificacao: 'essencial',
            icone: '🃏',
            ativa: true,
            sincrona: true,
            apoio: false,
            ordemCompleta: 2,
            resumo: 'Explora perfis de usuários e situações de criação.'
        },
        {
            id: 'mapa-empatia',
            arquivo: 'mapa-empatia.html',
            nome: 'Mapa de Empatia',
            fase: 1,
            classificacao: 'recomendada',
            icone: '🗺️',
            ativa: true,
            sincrona: true,
            apoio: false,
            ordemCompleta: 3,
            resumo: 'Aprofunda a compreensão do inventor e do contexto da criação.'
        },
        {
            id: 'canvas-diagnostico',
            arquivo: 'canvas-diagnostico.html',
            nome: 'Canvas de Diagnóstico',
            fase: 2,
            classificacao: 'essencial',
            icone: '📐',
            ativa: true,
            sincrona: true,
            apoio: false,
            ordemCompleta: 4,
            resumo: 'Organiza evidências para análise do problema de PI.'
        },
        {
            id: 'arvore',
            arquivo: 'arvore.html',
            nome: 'Árvore de Decisão',
            fase: 2,
            classificacao: 'essencial',
            icone: '🌳',
            ativa: true,
            sincrona: true,
            apoio: true,
            ordemCompleta: 5,
            resumo: 'Ajuda a decidir caminhos de proteção conforme o tipo de criação.'
        },
        {
            id: 'linha-do-tempo',
            arquivo: 'linha-do-tempo.html',
            nome: 'Linha do Tempo',
            fase: 2,
            classificacao: 'opcional',
            icone: '📅',
            ativa: true,
            sincrona: true,
            apoio: false,
            ordemCompleta: 6,
            resumo: 'Contextualiza a evolução histórica da PI no Brasil.'
        },
        {
            id: 'busca',
            arquivo: 'busca.html',
            nome: 'Busca de Anterioridade',
            fase: 3,
            classificacao: 'recomendada',
            icone: '🔍',
            ativa: true,
            sincrona: true,
            apoio: false,
            ordemCompleta: 7,
            resumo: 'Estimula investigação de anterioridade e referência tecnológica.'
        },
        {
            id: 'storyboard',
            arquivo: 'storyboard.html',
            nome: 'Roteiro de Proteção',
            fase: 3,
            classificacao: 'recomendada',
            icone: '🎬',
            ativa: true,
            sincrona: true,
            apoio: false,
            ordemCompleta: 8,
            resumo: 'Constrói a narrativa visual da ideia até o registro.'
        },
        {
            id: 'canvas-estrategia',
            arquivo: 'canvas-estrategia.html',
            nome: 'Canvas de Estratégia',
            fase: 3,
            classificacao: 'essencial',
            icone: '🧩',
            ativa: true,
            sincrona: true,
            apoio: false,
            ordemCompleta: 9,
            resumo: 'Consolida a estratégia de proteção e encaminhamento.'
        },
        {
            id: 'simulador-deposito',
            arquivo: 'simulador-deposito.html',
            nome: 'Simulador de Depósito',
            fase: 4,
            classificacao: 'essencial',
            icone: '📝',
            ativa: true,
            sincrona: true,
            apoio: false,
            ordemCompleta: 10,
            resumo: 'Simula o depósito com etapas, custos e documentação.'
        },
        {
            id: 'baralho-dilemas',
            arquivo: 'baralho-dilemas.html',
            nome: 'Baralho de Dilemas',
            fase: 4,
            classificacao: 'essencial',
            icone: '⚖️',
            ativa: true,
            sincrona: true,
            apoio: false,
            ordemCompleta: 11,
            resumo: 'Promove debate ético e estratégico sobre decisões em PI.'
        },
        {
            id: 'escape-room',
            arquivo: 'escape-room.html',
            nome: 'Escape Room',
            fase: 4,
            classificacao: 'opcional',
            icone: '🔐',
            ativa: true,
            sincrona: true,
            apoio: false,
            ordemCompleta: 12,
            resumo: 'Desafia a equipe com enigmas de PI em formato lúdico.'
        },
        {
            id: 'quiz-final',
            arquivo: 'quiz-final.html',
            nome: 'Quiz Final',
            fase: 5,
            classificacao: 'essencial',
            icone: '🏁',
            ativa: true,
            sincrona: true,
            apoio: false,
            ordemCompleta: 13,
            resumo: 'Avaliação final da oficina e comparação com o diagnóstico.'
        },
        {
            id: 'canvas-avaliacao',
            arquivo: 'canvas-avaliacao.html',
            nome: 'Canvas de Avaliação',
            fase: 5,
            classificacao: 'recomendada',
            icone: '⭐',
            ativa: true,
            sincrona: true,
            apoio: false,
            ordemCompleta: 14,
            resumo: 'Sistematiza aprendizados, melhorias e próximos passos.'
        },
        {
            id: 'pi-quest',
            arquivo: 'pi-quest.html',
            nome: 'Jornada da PI',
            fase: 5,
            classificacao: 'assincrona',
            icone: '🎮',
            ativa: true,
            sincrona: false,
            posOficina: true,
            apoio: false,
            ordemCompleta: 15,
            resumo: 'Trilha assíncrona pós-oficina liberada após a conclusão do percurso.'
        },
        {
            id: 'glossario',
            arquivo: 'glossario.html',
            nome: 'Glossário Dinâmico',
            fase: 0,
            classificacao: 'apoio',
            icone: '📘',
            ativa: true,
            sincrona: false,
            apoio: true,
            ordemCompleta: 0,
            resumo: 'Consulta rápida a conceitos de PI.'
        },
        {
            id: 'calculadora',
            arquivo: 'calculadora.html',
            nome: 'Calculadora de Vigência',
            fase: 0,
            classificacao: 'apoio',
            icone: '🧮',
            ativa: true,
            sincrona: false,
            apoio: true,
            ordemCompleta: 0,
            resumo: 'Cálculo de vigência e prazos de proteção.'
        },
        {
            id: 'crazy8s',
            arquivo: 'crazy8s.html',
            nome: 'Crazy 8s da PI',
            fase: 3,
            classificacao: 'legado',
            icone: '⏳',
            ativa: false,
            sincrona: false,
            legado: true,
            apoio: false,
            ordemCompleta: 999,
            resumo: 'Arquivo legado mantido apenas para referência histórica.'
        }
    ];

    var PERCURSOS = {
        '2h': {
            id: '2h',
            nome: 'Compacto',
            duracao: '2h',
            classe: 'compacto',
            descricao: 'Percurso com 8 ferramentas essenciais para oficinas compactas.',
            ferramentas: [
                'quiz-diagnostico',
                'cartas-personas',
                'canvas-diagnostico',
                'arvore',
                'canvas-estrategia',
                'simulador-deposito',
                'baralho-dilemas',
                'quiz-final'
            ]
        },
        '3h': {
            id: '3h',
            nome: 'Padrão',
            duracao: '3h',
            classe: 'padrao',
            descricao: 'Percurso com essenciais e recomendadas para maior aprofundamento.',
            ferramentas: [
                'quiz-diagnostico',
                'cartas-personas',
                'mapa-empatia',
                'canvas-diagnostico',
                'arvore',
                'busca',
                'storyboard',
                'canvas-estrategia',
                'simulador-deposito',
                'baralho-dilemas',
                'quiz-final',
                'canvas-avaliacao'
            ]
        },
        '4h': {
            id: '4h',
            nome: 'Completo',
            duracao: '4h',
            classe: 'completo',
            descricao: 'Percurso com todas as 14 ferramentas síncronas da oficina.',
            ferramentas: [
                'quiz-diagnostico',
                'cartas-personas',
                'mapa-empatia',
                'canvas-diagnostico',
                'arvore',
                'linha-do-tempo',
                'busca',
                'storyboard',
                'canvas-estrategia',
                'simulador-deposito',
                'baralho-dilemas',
                'escape-room',
                'quiz-final',
                'canvas-avaliacao'
            ]
        }
    };

    var ALIASES = {
        'busca-anterioridade': 'busca',
        'roteiro-protecao': 'storyboard',
        'storyboard-de-protecao': 'storyboard',
        'jornada-da-pi': 'pi-quest',
        'piquest': 'pi-quest',
        'arvore-apoio': 'arvore',
        'quizdiagnostico': 'quiz-diagnostico',
        'quizfinal': 'quiz-final',
        'canvasdiagnostico': 'canvas-diagnostico',
        'canvasestrategia': 'canvas-estrategia',
        'canvasavaliacao': 'canvas-avaliacao'
    };

    var INSTITUICOES = [
        { id: 'ufrr', nome: 'UFRR', arquivo: 'img/UFRR.png' },
        { id: 'profnit', nome: 'PROFNIT', arquivo: 'img/PROFNIT.png' },
        { id: 'inovarr', nome: 'INOVARR', arquivo: 'img/INOVARR.png' }
    ];

    var CREDITOS = {
        licenca: 'CC BY-NC-SA 4.0',
        credito: '© 2025 PI Thinking — PROFNIT / UFRR'
    };

    function clone(value) {
        return JSON.parse(JSON.stringify(value));
    }

    function normalizeId(id) {
        if (!id && id !== 0) return '';
        var clean = String(id).trim().replace(/\.html$/i, '').toLowerCase();
        return ALIASES[clean] || clean;
    }

    function findTool(idOrFile) {
        var normalized = normalizeId(idOrFile);
        for (var i = 0; i < FERRAMENTAS.length; i += 1) {
            var tool = FERRAMENTAS[i];
            if (tool.id === normalized || tool.arquivo.replace(/\.html$/i, '') === normalized) {
                return clone(enrichTool(tool));
            }
        }
        return null;
    }

    function enrichTool(tool) {
        var fase = tool.fase ? getFase(tool.fase) : null;
        var classificacao = CLASSIFICACOES[tool.classificacao] || null;
        return Object.assign({}, tool, {
            faseDados: fase,
            classificacaoDados: classificacao,
            url: tool.arquivo,
            labelClassificacao: classificacao ? classificacao.rotulo : '',
            siglaClassificacao: classificacao ? classificacao.sigla : ''
        });
    }

    function listTools(options) {
        var opts = options || {};
        return FERRAMENTAS
            .filter(function (tool) {
                if (opts.ativasOnly && !tool.ativa) return false;
                if (opts.sincronasOnly && !tool.sincrona) return false;
                if (opts.apoioOnly && !tool.apoio) return false;
                if (opts.legadoOnly && !tool.legado) return false;
                if (typeof opts.fase === 'number' && tool.fase !== opts.fase) return false;
                if (opts.classificacao && tool.classificacao !== opts.classificacao) return false;
                return true;
            })
            .sort(function (a, b) {
                return a.ordemCompleta - b.ordemCompleta;
            })
            .map(function (tool) {
                return clone(enrichTool(tool));
            });
    }

    function getFase(num) {
        for (var i = 0; i < FASES.length; i += 1) {
            if (FASES[i].num === Number(num)) return clone(FASES[i]);
        }
        return null;
    }

    function getPercurso(key) {
        var percurso = PERCURSOS[key];
        return percurso ? clone(percurso) : null;
    }

    function buildPercurso(key) {
        var percurso = getPercurso(key);
        if (!percurso) return null;
        var ferramentas = percurso.ferramentas.map(function (id, index) {
            var tool = findTool(id);
            if (!tool) return null;
            tool.posicao = index + 1;
            tool.totalNoPercurso = percurso.ferramentas.length;
            tool.percurso = { id: percurso.id, nome: percurso.nome, duracao: percurso.duracao };
            return tool;
        }).filter(Boolean);
        percurso.ferramentasDetalhadas = ferramentas;
        percurso.totalFerramentas = ferramentas.length;
        return percurso;
    }

    function getToolsByPhase(num, options) {
        var opts = Object.assign({}, options || {}, { fase: Number(num) });
        return listTools(opts);
    }

    function getSupportTools() {
        return listTools({ apoioOnly: true, ativasOnly: true });
    }

    function getLegacyTools() {
        return listTools({ legadoOnly: true });
    }

    function getPostWorkshopTool() {
        return findTool('pi-quest');
    }

    function getToolByFileName(fileName) {
        return findTool(fileName);
    }

    function listPercursos() {
        return Object.keys(PERCURSOS).map(function (key) {
            return buildPercurso(key);
        });
    }

    function buildSequentialMap(percursoKey) {
        var percurso = buildPercurso(percursoKey || '4h');
        if (!percurso) return {};
        var map = {};
        percurso.ferramentasDetalhadas.forEach(function (tool, index, arr) {
            map[tool.id] = {
                anterior: index > 0 ? clone(arr[index - 1]) : null,
                atual: clone(tool),
                proxima: index < arr.length - 1 ? clone(arr[index + 1]) : null,
                indice: index,
                total: arr.length
            };
        });
        return map;
    }

    function getPrevNext(toolId, percursoKey) {
        var map = buildSequentialMap(percursoKey || '4h');
        var normalized = normalizeId(toolId);
        return map[normalized] || { anterior: null, atual: findTool(normalized), proxima: null, indice: -1, total: 0 };
    }

    function getCatalogoSincrono() {
        return listTools({ sincronaOnly: true, ativasOnly: true });
    }

    function getDashboardCatalog() {
        return buildPercurso('4h').ferramentasDetalhadas;
    }

    function getResumoEstrutura() {
        return {
            totalFases: FASES.length,
            totalFerramentasSincronas: getCatalogoSincrono().length,
            totalFerramentasApoio: getSupportTools().length,
            jornadaPosOficina: getPostWorkshopTool(),
            legado: getLegacyTools()
        };
    }

    var api = {
        version: VERSION,
        FASES: clone(FASES),
        FERRAMENTAS: listTools(),
        PERCURSOS: clone(PERCURSOS),
        CLASSIFICACOES: clone(CLASSIFICACOES),
        INSTITUICOES: clone(INSTITUICOES),
        CREDITOS: clone(CREDITOS),
        normalizeId: normalizeId,
        getFase: getFase,
        getPercurso: getPercurso,
        buildPercurso: buildPercurso,
        listPercursos: listPercursos,
        getTool: findTool,
        getToolByFileName: getToolByFileName,
        listTools: listTools,
        getToolsByPhase: getToolsByPhase,
        getSupportTools: getSupportTools,
        getLegacyTools: getLegacyTools,
        getPostWorkshopTool: getPostWorkshopTool,
        getPrevNext: getPrevNext,
        buildSequentialMap: buildSequentialMap,
        getCatalogoSincrono: getCatalogoSincrono,
        getDashboardCatalog: getDashboardCatalog,
        getResumoEstrutura: getResumoEstrutura
    };

    global.PIConfig = api;
    global.PITHINKING_CONFIG = api;
})(window);
