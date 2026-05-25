# PI Thinking — Kit de Ferramentas de Propriedade Intelectual

> Toolkit web educacional para oficinas de Propriedade Intelectual com abordagem de **Design Thinking**, desenvolvido no **PROFNIT — ponto focal UFRR**, alinhado ao **Eixo 2 da ENPI 2021–2030**.

**Produção:** https://rafaeaguiarecai-beep.github.io/toolkit_propriedade_intelectual/  
**Licença:** CC BY-NC-SA 4.0  
**Crédito:** © 2025 PI Thinking — PROFNIT / UFRR

---

## 1. Visão geral

O **PI Thinking** é um kit de ferramentas web em **HTML, CSS e JavaScript vanilla**, com sincronização opcional via **Firebase Realtime Database**, criado para apoiar oficinas presenciais, híbridas e atividades assíncronas sobre Propriedade Intelectual.

A proposta combina:

- aprendizagem ativa;
- raciocínio estratégico sobre proteção de criações;
- mediação pedagógica por fases;
- percursos adaptáveis conforme o tempo disponível;
- transição entre oficina síncrona e continuidade assíncrona.

---

## 2. Estrutura pedagógica

### Fases e ferramentas

| Fase | Nome | Ferramentas | Bloom |
|---|---|---|---|
| 1 | **Descobrir** | Quiz Diagnóstico (E), Cartas Personas (E), Mapa de Empatia (R) | Lembrar, Compreender |
| 2 | **Diagnosticar** | Canvas de Diagnóstico (E), Árvore de Decisão (E), Linha do Tempo (O) | Compreender, Aplicar |
| 3 | **Estrategar** | Busca de Anterioridade (R), Roteiro de Proteção (R), Canvas de Estratégia (E) | Aplicar, Analisar |
| 4 | **Testar** | Simulador de Depósito (E), Baralho de Dilemas (E), Escape Room (O) | Analisar, Avaliar |
| 5 | **Evoluir** | Quiz Final (E), Canvas de Avaliação (R) | Avaliar, Criar |

**Legenda:** E = Essencial · R = Recomendada · O = Opcional

### Ferramenta assíncrona pós-oficina

- **Jornada da PI** (arquivo `pi-quest.html`, antigo “PI Quest”)
- desbloqueada após a conclusão da oficina
- acessível pelo módulo do aluno como continuidade formativa

### Ferramentas de apoio contínuo

- Glossário Dinâmico
- Calculadora de Vigência
- Árvore de Decisão

---

## 3. Percursos de aplicação

### Percurso 2h — Compacto
1. Quiz Diagnóstico
2. Cartas Personas
3. Canvas de Diagnóstico
4. Árvore de Decisão
5. Canvas de Estratégia
6. Simulador de Depósito
7. Baralho de Dilemas
8. Quiz Final

### Percurso 3h — Padrão
1. Quiz Diagnóstico
2. Cartas Personas
3. Mapa de Empatia
4. Canvas de Diagnóstico
5. Árvore de Decisão
6. Busca de Anterioridade
7. Roteiro de Proteção
8. Canvas de Estratégia
9. Simulador de Depósito
10. Baralho de Dilemas
11. Quiz Final
12. Canvas de Avaliação

### Percurso 4h — Completo
1. Quiz Diagnóstico
2. Cartas Personas
3. Mapa de Empatia
4. Canvas de Diagnóstico
5. Árvore de Decisão
6. Linha do Tempo
7. Busca de Anterioridade
8. Roteiro de Proteção
9. Canvas de Estratégia
10. Simulador de Depósito
11. Baralho de Dilemas
12. Escape Room
13. Quiz Final
14. Canvas de Avaliação

---

## 4. Arquitetura técnica

### Stack principal

- **HTML5**
- **CSS3** com design system compartilhado
- **JavaScript vanilla**
- **Firebase Realtime Database** para modo oficina, ranking, sincronização e acompanhamento

### Organização esperada

```text
/
├── index.html
├── aluno.html
├── dashboard.html
├── guia-facilitador.html
├── style.css
├── script.js
├── quiz-diagnostico.html
├── quiz-final.html
├── storyboard.html
├── pi-quest.html
├── busca.html
├── simulador-deposito.html
├── canvas-estrategia.html
├── canvas-diagnostico.html
├── canvas-avaliacao.html
├── cartas-personas.html
├── mapa-empatia.html
├── linha-do-tempo.html
├── glossario.html
├── calculadora.html
├── arvore.html
├── escape-room.html
├── baralho-dilemas.html
├── crazy8s.html
├── js/
│   ├── config-ferramentas.js
│   ├── aluno-engine.js
│   ├── tool-bridge.js
│   ├── sync.js
│   ├── firebase-config.example.js
│   └── ...
└── img/
    ├── UFRR.png
    ├── PROFNIT.png
    └── INOVARR.png
```

---

## 5. Convenções de nomenclatura e decisões curriculares

### Renomeações adotadas

- **Storyboard de Proteção** → **Roteiro de Proteção** (`storyboard.html`)
- **PI Quest** → **Jornada da PI** (`pi-quest.html`)
- **Toolkit / toolkit** → **Kit de Ferramentas / kit de ferramentas**
- **Design Sprint** → **Design Thinking**
- Fase 4 **Prototipar** → **Testar**

### Termos preservados em inglês

- Canvas
- Dashboard
- Escape Room
- Quiz

### Ferramenta removida do fluxo principal

- `crazy8s.html` permanece no projeto, mas passa a operar como **arquivo legado**, com banner explícito informando que está fora do fluxo ativo da oficina.

---

## 6. Como executar localmente

Por ser um projeto estático, é possível abrir os arquivos HTML diretamente no navegador. Para testes mais consistentes, recomenda-se um servidor local simples.

### Opção A — VS Code + Live Server
1. Abra a pasta do projeto no VS Code.
2. Instale a extensão **Live Server**.
3. Clique em **Open with Live Server** no `index.html`.

### Opção B — Python
```bash
python3 -m http.server 8000
```
Depois, acesse: `http://localhost:8000`

---

## 7. Configuração do Firebase com segurança

> **Importante:** o arquivo real de configuração **não deve ser versionado**.

### Arquivos esperados

- `js/firebase-config.example.js` → modelo seguro para compartilhamento
- `js/firebase-config.js` → arquivo local, preenchido com as credenciais do ambiente e ignorado pelo Git

### Fluxo recomendado

1. Copie o exemplo:
   ```bash
   cp js/firebase-config.example.js js/firebase-config.js
   ```
2. Preencha as chaves do seu projeto Firebase.
3. Garanta que `js/firebase-config.js` continue listado no `.gitignore`.

### Exemplo de políticas de uso

- usar ranking e sincronização apenas no modo oficina;
- separar instâncias de desenvolvimento e produção;
- revisar regras de leitura e escrita no Realtime Database;
- nunca publicar chaves sensíveis em repositórios públicos quando houver risco operacional associado.

---

## 8. Diretrizes de interface e acessibilidade

O projeto deve manter:

- `lang="pt-BR"` em todas as páginas;
- navegação coerente entre fases e ferramentas;
- `aria-label`, `aria-live`, `role` e suporte a teclado nos componentes interativos;
- classe global `.sr-only`;
- suporte a `prefers-reduced-motion`;
- contraste adequado e foco visível;
- rodapé institucional padronizado com logos `img/UFRR.png`, `img/PROFNIT.png` e `img/INOVARR.png`.

---

## 9. Sincronização, progresso e oficina

No modo oficina, a infraestrutura JavaScript deve permitir:

- identificação do participante;
- persistência de progresso por ferramenta;
- auto-save unificado por `tool-bridge.js`;
- leitura do estado geral do aluno no módulo `aluno.html`;
- ranking em tempo real nos quizzes;
- comparação entre desempenho inicial e final para cálculo de evolução.

---

## 10. Arquivos centrais do projeto

### Estruturais
- `index.html` — página principal do kit
- `aluno.html` — módulo do aluno
- `dashboard.html` — painel do facilitador
- `guia-facilitador.html` — orientação pedagógica e operacional

### Infraestrutura
- `style.css` — sistema visual compartilhado
- `script.js` — interações globais do site
- `js/config-ferramentas.js` — fonte única de metadados
- `js/tool-bridge.js` — persistência unificada
- `js/sync.js` — sincronização do modo oficina
- `js/aluno-engine.js` — motor do módulo do aluno

### Ferramentas com alteração mais profunda
- `quiz-diagnostico.html`
- `quiz-final.html`
- `storyboard.html`
- `pi-quest.html`
- `busca.html`
- `canvas-estrategia.html`

---

## 11. Roadmap de reestruturação

### Bloco 1 — JS de infraestrutura
- `js/config-ferramentas.js`
- `js/aluno-engine.js`
- `js/sync.js`
- `js/tool-bridge.js`
- `script.js`
- `js/firebase-config.example.js`

### Bloco 2 — CSS, configuração e documentação
- `style.css`
- `.gitignore`
- `README.md`

### Bloco 3 — Páginas estruturais
- `index.html`
- `aluno.html`
- `dashboard.html`
- `guia-facilitador.html`

### Bloco 4 — Ferramentas com alterações profundas
- `quiz-diagnostico.html`
- `quiz-final.html`
- `storyboard.html`
- `pi-quest.html`
- `busca.html`
- `canvas-estrategia.html`

### Bloco 5 — Ferramentas com alterações leves
- `arvore.html`
- `calculadora.html`
- `canvas-avaliacao.html`
- `canvas-diagnostico.html`
- `cartas-personas.html`
- `escape-room.html`
- `glossario.html`
- `linha-do-tempo.html`
- `mapa-empatia.html`
- `simulador-deposito.html`
- `baralho-dilemas.html`

### Bloco 6 — Arquivo isolado
- `crazy8s.html`

---

## 12. Publicação

A publicação atual é feita via GitHub Pages:

**URL de produção:** https://rafaeaguiarecai-beep.github.io/toolkit_propriedade_intelectual/

Antes de publicar, revisar:

- links entre páginas;
- paths das logos com case correto (`img/UFRR.png`, `img/PROFNIT.png`, `img/INOVARR.png`);
- remoção de arquivos sensíveis do versionamento;
- consistência entre modo oficina e modo individual.

---

## 13. Licença e créditos

Este projeto está licenciado sob **CC BY-NC-SA 4.0**.

**Crédito obrigatório:**  
© 2025 PI Thinking — PROFNIT / UFRR

---

## 14. Contato institucional

Projeto vinculado ao **PROFNIT** no ponto focal **UFRR**, com apoio institucional relacionado à inovação, tecnologia e formação em Propriedade Intelectual.

Para versões públicas, recomenda-se manter no rodapé:

- logos institucionais;
- crédito do projeto;
- menção à licença;
- referência ao uso educacional do kit de ferramentas.