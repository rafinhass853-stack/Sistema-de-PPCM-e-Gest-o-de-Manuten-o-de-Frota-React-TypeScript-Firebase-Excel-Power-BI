# Sistema de PPCM e Gestão de Manutenção de Frota — EIXO SP

Sistema web para Planejamento, Programação e Controle da Manutenção (PPCM), estruturado para uma operação de frota rodoviária com veículos leves, pesados, guinchos e veículos operacionais.

## Objetivo
Transformar a manutenção em uma operação controlada por dados: **Frota → Preventiva → OS → Peças/Mão de obra → Custos → Disponibilidade → KPIs → Orçamento → Gestão**.

## Módulos
- **Dashboard executivo:** disponibilidade, backlog, custo, preventivas atrasadas, estoque crítico e últimas OS.
- **Frota:** cadastro mestre, classificação, base, centro de custo, combustível, odômetro, oficina responsável, garantia e status.
- **Preventivas:** planos por KM e tempo, próxima execução, criticidade e aderência.
- **Ordens de Serviço:** preventiva, corretiva, preditiva, inspeção e campanha; prioridade, programação, oficina, causa, solução, peças e mão de obra.
- **Inspeções:** pré-viagem, operacional, segurança e pós-manutenção.
- **Estoque:** peças e materiais com estoque mínimo e valor financeiro.
- **Oficinas:** oficinas internas, externas, concessionárias e especializadas.
- **Indicadores:** disponibilidade, MTBF, MTTR, aderência preventiva, conformidade de inspeções, custo total e custo/KM.
- **Relatórios:** Excel estruturado e preparação para Power BI.
- **Orçamento:** coleção `budgets` preparada para planejamento anual por categoria.

## Modelo de dados
`vehicles`, `maintenancePlans`, `workOrders`, `inspections`, `parts`, `workshops`, `odometerReadings`, `budgets`.

Relacionamento recomendado:

`Veículo → Plano Preventivo → OS → Peças/Mão de obra → Custo → KPI`

## KPIs prioritários
1. Disponibilidade da frota
2. Aderência ao plano preventivo
3. MTBF — tempo médio entre falhas
4. MTTR — tempo médio para reparo
5. Custo de manutenção por KM
6. Custo por veículo/classificação
7. Backlog de OS
8. Tempo de parada
9. Produtividade da oficina
10. Conformidade das inspeções
11. Itens críticos de estoque
12. Realizado x orçamento

## Power BI
O Excel exportado possui abas separadas para Frota, OS, Preventivas, Inspeções, Estoque, Oficinas, Odômetros e Orçamento. A evolução recomendada é um modelo estrela com dimensões de Data, Veículo, Oficina, Tipo de manutenção, Centro de custo e uma camada fato para OS, custos, inspeções e odômetros.

## Execução
```bash
npm install
npm run dev
npm run build
```

O deploy é feito pelo GitHub Actions/Firebase Hosting.

> A identidade visual atual é **inspirada** na comunicação visual da Eixo SP. O símbolo textual EIXO [SP] é uma aproximação; para uso institucional, substitua pelo arquivo oficial do logotipo fornecido pela empresa.
