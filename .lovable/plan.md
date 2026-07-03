# Ajustes no chat do Almoxarifado (`almoxChat`)

Arquivo: `src/lib/app.functions.ts` (função `almoxChat`, ~linhas 1351–1454). Nenhuma mudança de UI.

## Mudanças

1. **System prompt mais restritivo** — adicionar instrução explícita:
   > "Responda apenas com base nos dados fornecidos abaixo, em formato JSON. Não invente nomes, datas, peças ou quantidades que não estejam presentes nos dados. Se a pergunta não puder ser respondida com os dados disponíveis, diga claramente que não encontrou essa informação."
   
   Mantém a instrução de resposta curta/direta e a frase padrão de fallback.

2. **Dados estruturados como JSON puro** — já são arrays de objetos, mas padronizar campos entre as duas listas para: `tecnico`, `peca`, `quantidade`, `data`, `status`, `origem`.
   - `pecasRows`: `origem` = `"PCM"` ou `"Almoxarifado"` (já existe).
   - `reqRows`: adicionar `origem: "Requisições da Oficina"` (substituindo/mantendo `extra` como campo auxiliar).
   - Enviar como um único array combinado `dados` (além de manter contagens no texto), para o modelo enxergar tudo uniformemente.

3. **`temperature: 0`** no body da chamada ao gateway para respostas determinísticas.

4. **Logs de debug no servidor** — antes do `fetch`, `console.log` com:
   - janela de datas (`startISO`, `endISO`, `todayISO`)
   - contagem e amostra (primeiros 5) de `pecasRows` e `reqRows`
   - a pergunta recebida
   
   Aparece em `server-function-logs` para diagnóstico.

## Não muda

- Modelo (`google/gemini-3-flash-preview`), autenticação por PIN, queries no banco, UI da tela `almoxarifado.tsx`.
