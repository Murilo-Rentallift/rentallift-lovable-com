## Mudanças

### 1. Admin com abas (Operadores / Próximos Chamados)
- Em `src/routes/admin.tsx`, adicionar um sistema de abas no topo da tela principal:
  - **Aba "Operadores"**: conteúdo atual (lista de operadores, agendamentos, etc.).
  - **Aba "Próximos Chamados"**: o `PendingCallsCalendar` que hoje aparece sobreposto/no topo passa a viver dentro desta segunda aba, ocupando a página inteira.
- Remover o calendário da posição atual (antes da lista de operadores) e remover o modal/backdrop fixo — vira conteúdo inline da aba.
- Estado `activeTab` simples (`"operadores" | "chamados"`), persistido só em memória.

### 2. Almoxarifado pode apagar peças
- Nova server function em `src/lib/app.functions.ts`: `almoxDeletePart({ pin, partId })` — valida PIN do almoxarifado (ou admin) e deleta a linha de `parts`.
- Em `src/routes/almoxarifado.tsx`, ao lado de cada peça (junto do select de status), adicionar um botão de lixeira que chama `almoxDeletePart` e atualiza a lista local.
- Confirmação simples via `confirm()` antes de excluir.

### Detalhes técnicos
- Sem mudanças no banco (uso do DELETE direto na tabela `parts` via service role no server fn, mantendo o padrão já usado em `adminDeletePendingCall`).
- Sem novas rotas: as "duas páginas" do admin são abas dentro de `/admin`, conforme pedido ("2ª página na mesma aba do admin").
- Componente `PendingCallsCalendar` continua o mesmo; só muda onde ele é renderizado (dentro da aba, sem overlay fixo).
