# Resumo do documento original

## Identificação

- **Título:** *Guidelines for Standardization of the Representation of Sanitary Attestations in Official Certificates*
- **Arquivo consultado:** `Documents_Sanitary_requirements_representation_v17.pdf`
- **Extensão:** 41 páginas
- **Finalidade deste resumo:** consulta rápida do conteúdo normativo e operacional do documento. Este resumo não substitui o texto original.

## 1. Ideia central

O documento propõe uma forma mais clara, consistente, verificável e estruturada de representar sanitary attestations em certificados oficiais. A proposta procura reduzir ambiguidade, duplicação e interpretações divergentes entre autoridades competentes de países importadores e exportadores.

O documento trata principalmente da **representação de attestations já acordadas ou em negociação**. Ele não cria, por si só, novos requisitos sanitários, não estabelece informação além da necessária para assegurar a segurança dos alimentos e não altera a estrutura normativa dos certificados oficiais prevista em outros textos Codex.

A abordagem é neutra quanto à tecnologia: pode ser aplicada a certificados em papel e, progressivamente, a sistemas eletrônicos. A estrutura proposta serve como base para digitalização, mas não prescreve uma tecnologia específica.

## 2. Escopo e objetivos

As orientações apoiam autoridades competentes em:

- desenvolver, revisar, negociar, acordar e representar attestations;
- simplificar a linguagem e reduzir interpretações divergentes;
- identificar e eliminar duplicações, inconsistências e ambiguidades;
- facilitar inspeção, certificação, auditoria e futura validação automatizada;
- melhorar a interoperabilidade entre sistemas, certificados e jurisdições;
- adaptar a aplicação às capacidades nacionais, aos marcos legais e ao ambiente operacional.

O foco é a segurança dos alimentos. Questões de comércio justo, saúde animal ou saúde vegetal ficam fora do escopo, salvo quando estiverem diretamente relacionadas à segurança dos alimentos.

## 3. Conceitos essenciais

### Sanitary attestation

Declaração em certificado oficial que confirma que requisitos de segurança dos alimentos foram atendidos.

### Modalidade

Tipo de requisito regulatório que origina a attestation: obrigação, proibição, permissão ou limite. É metadado analítico sobre a origem normativa; a attestation final deve ser expressa como declaração de um fato verificado.

### Função comunicativa

Forma concreta pela qual a intenção regulatória é expressa. Uma mesma modalidade pode ter funções diferentes, como confirmar uma ação, confirmar conformidade com um padrão, registrar uma precaução ou atribuir responsabilidade.

### Ontologia e método baseado em ontologia

Representação estruturada de conceitos e relações de um domínio, usada para obter entendimento compartilhado e permitir representação consistente e legível por máquinas.

### Padronização semântica

Uso consistente de termos com o mesmo significado em certificados, contextos e autoridades diferentes.

### Padronização sintática

Uso de estrutura e formato harmonizados para facilitar comparação, processamento e validação automatizada.

### Tripla

Representação simples em três partes: **sujeito - predicado - objeto**. Exemplo conceitual: `Milk - freeFrom - Disease`.

### Interoperabilidade

Capacidade de sistemas diferentes trocarem dados e usarem a informação trocada de modo correto e significativo.

## 4. Os cinco princípios

### A. Clareza e Consistência

As attestations devem usar linguagem clara, concisa e padronizada, com estrutura e terminologia que conduzam à mesma interpretação pelas autoridades importadora e exportadora.

Pontos principais:

- identificar a unidade semântica;
- identificar commodity/produto, perigo ou domínio de assurance, atividade/processo e qualificadores temporais ou espaciais;
- identificar a modalidade e a função comunicativa;
- evitar frases complexas, terminologia inconsistente, repetição e expressões abertas;
- manter juntas cláusulas que formam uma única assurance e separar assurances independentes.

### B. Transparência e Objetividade

As attestations devem deixar claros seu fundamento, escopo e implicações, usando termos objetivos, observáveis ou mensuráveis.

Pontos principais:

- dividir attestations complexas em unidades verificáveis;
- evitar termos como `adequado`, `suficiente` e `apropriado` sem critério ou referência;
- reduzir dependência de conhecimento implícito de práticas nacionais;
- permitir a identificação da evidência que comprova cada declaração;
- mapear a intenção para referências Codex ou outras referências oficiais quando relevante.

### C. Verificabilidade e Auditabilidade

As attestations devem poder ser verificadas e auditadas. Sempre que possível, devem usar termos mensuráveis ou observáveis e estrutura que permita validação humana ou eletrônica.

O documento sugere decompor a attestation em componentes e representá-la como triplas sujeito-predicado-objeto. Isso explicita as relações centrais e favorece rastreabilidade, reuso e automação.

### D. Interoperabilidade

As attestations estruturadas devem usar vocabulários controlados e relações semânticas bem definidas para que sejam trocadas e comparadas entre plataformas e jurisdições.

O documento recomenda:

- termos preferidos e consistentes;
- categorias separadas de instâncias e atributos;
- forma de dicionário e convenções de nomenclatura;
- predicados padronizados, incluindo convenção camelCase;
- unidades de medida e formatos reconhecidos internacionalmente;
- predicados na forma de declaração factual/afirmativa, conforme o vocabulário adotado.

### E. Preservação do Significado

A representação estruturada não pode alterar a substância, o escopo ou a intenção regulatória da attestation. Deve manter equivalência com o texto humano autoritativo.

A validação humana continua essencial. A estrutura digital apoia o texto oficial, mas não o substitui.

## 5. Relação entre os princípios

Os princípios A e B são a base da representação humana. C, D e E dependem de uma attestation previamente esclarecida e estruturada.

```text
A Clareza e Consistência
             +
B Transparência e Objetividade
             |
             +--> C Verificabilidade e Auditabilidade
             +--> D Interoperabilidade
             +--> E Preservação do Significado
```

Na prática, uma attestation ambígua não deve ser convertida diretamente em campos estruturados ou triplas. Primeiro é necessário esclarecer sua unidade, elementos, modalidade, função e escopo.

## 6. Critérios essenciais de aplicação

### 6.1 Uma assurance por attestation, quando possível

Cada attestation deve conter uma única declaração claramente identificável. Assurances independentes devem ser formuladas como declarações distintas, sem fragmentar cláusulas que dependem umas das outras.

### 6.2 Elementos que delimitam escopo e intenção

Devem ser considerados, conforme aplicável:

- produto, commodity, lote ou remessa;
- perigo, doença, contaminante ou domínio de segurança dos alimentos;
- ação, tratamento, processo, inspeção ou verificação;
- estabelecimento, instalação, autoridade, operador ou outro agente;
- tempo, local, transporte, armazenamento ou etapa da cadeia;
- condição, exceção, limite, unidade de medida e referência normativa.

### 6.3 Formulação factual

O requisito normativo pode ser uma obrigação ou proibição, mas a attestation normalmente declara o fato verificado. Por exemplo, uma obrigação de embalagem pode ser representada como: “Products of this consignment were packaged promptly.”

### 6.4 Parâmetros quantitativos

Temperatura, tempo, resíduos, níveis máximos, reduções logarítmicas e outros parâmetros devem usar unidades e formatos internacionalmente reconhecidos. O critério deve deixar claro se é máximo, mínimo, ausência, faixa, resultado ou conformidade com referência externa.

### 6.5 Aplicabilidade ao produto

Devem ser incluídas apenas attestations aplicáveis ao produto e, quando apropriado, vinculadas ao código HS aplicável. O documento recomenda reduzir deleções manuais e rasuras em certificados.

### 6.6 Validação humana

Mesmo com representação estruturada, a autoridade competente deve confirmar que a attestation:

- corresponde ao requisito regulatório pretendido;
- está alinhada à modalidade e à função comunicativa;
- preserva o significado e o escopo do texto autoritativo;
- mantém equivalência jurídica com a formulação aprovada.

## 7. Orientações para redação humana

O documento apresenta um procedimento geral de seis passos:

1. Identificar a modalidade.
2. Selecionar o padrão correspondente à função comunicativa.
3. Substituir os campos do padrão por elementos concretos.
4. Revisar clareza e concisão.
5. Conferir alinhamento terminológico com Codex e referências internacionais relevantes.
6. Confirmar que a frase é direta, inequívoca e sem jargão técnico desnecessário.

As attestations devem evitar:

- cláusulas subordinadas excessivas;
- condições múltiplas em uma única declaração;
- terminologia divergente para o mesmo conceito;
- expressões vagas ou abertas;
- repetição e informação não essencial;
- alteração inadvertida de escopo ao simplificar.

## 8. Anexo I: representação machine-readable

O Anexo I aplica C, D e E depois da clarificação feita por A e B.

### 8.1 Princípio C: conversão em triplas

Procedimento de dois passos:

1. Identificar sujeito, predicado e objeto, além de atributos e condições necessárias.
2. Expressar cada assurance como uma ou mais declarações estruturadas, mantendo separadas as condições relacionadas.

Exemplo do documento:

```text
PRODUCTS ; OBTAINED_FROM ; ESTABLISHMENTS
ESTABLISHMENTS ; IMPLEMENT ; GMP
ESTABLISHMENTS ; IMPLEMENT ; SSOP
ESTABLISHMENTS ; IMPLEMENT ; HACCP
```

### 8.2 Princípio D: normalização

O documento propõe cinco operações:

1. Substituir a entidade conceitual pela categoria, quando apropriado.
2. Representar a especificidade como atributo.
3. Usar a forma básica/de dicionário do termo.
4. Substituir sinônimos pelo termo preferido.
5. Expressar o predicado na forma afirmativa de attestation, conforme a semântica definida.

Exemplo de resultado normalizado:

```text
PRODUCT comesFrom FACILITY #type(Establishment)
  #practice(GMP) #practice(SSOP) #practice(HACCP)
```

O uso de camelCase, como `comesFrom` e `freeFrom`, apoia a leitura por máquinas.

### 8.3 Princípio E: validação de equivalência

A representação deve ser comparada ao texto para confirmar que preserva:

- sujeitos e objetos;
- relações e estados;
- escopo da remessa;
- condições, exceções e qualificadores;
- limites, negações e unidades;
- agente responsável, tempo e local;
- modalidade de origem e intenção regulatória.

## 9. Anexo 2: funções comunicativas

O Anexo 2 fornece padrões de requisito, exemplos de attestation e regras de representação. As funções são agrupadas por modalidade.

### Obrigação

- **Mandar uma ação ou estado:** confirma que uma ação foi realizada ou um estado foi alcançado.
- **Exigir conformidade com padrão, limite ou critério:** usa `complies with` e cita a referência.
- **Ordenar medidas de precaução:** confirma que medidas foram tomadas para prevenir um resultado.
- **Definir aceitação ou rejeição condicional:** confirma aceitação somente após verificação de uma condição.
- **Atribuir responsabilidade a um agente:** identifica quem realizou a ação requerida.
- **Suspender obrigação quando uma condição é atendida:** confirma que a obrigação não foi aplicada porque uma medida equivalente foi certificada.

### Permissão

- **Permitir substância ou ação:** confirma uso autorizado conforme padrão.
- **Dar permissão com condição:** confirma uso acompanhado do controle exigido.
- **Declarar cláusula de exceção:** confirma uso dentro do limite previsto pela exceção.
- **Autorizar ação por agente responsável:** confirma que uma autoridade aprovou o uso ou ação.

### Proibição

- **Proibir tratamento ou condição:** confirma que um tratamento não foi aplicado.
- **Proibir substância ou exceder limite:** confirma ausência ou atendimento de limite máximo.
- **Proibir armazenamento, colocação ou associação:** confirma que algo não foi colocado em local ou condição proibida.
- **Excluir pessoas, práticas ou materiais de risco:** confirma que não foram usados ou admitidos.
- **Levantar proibição mediante condição:** confirma que a condição para afastar a proibição foi verificada.
- **Desencorajar uso:** confirma que, quando o uso ocorreu, o controle condicional exigido foi aplicado.

### Limites e alvos

- **Citar limite ou condição oficial:** confirma atendimento a limites definidos por autoridade externa.
- **Definir critério quantitativo de aceitação:** confirma aceitação porque o resultado não excedeu o critério explícito.
- **Exigir ausência de condição indesejável:** usa uma formulação como `is free from`.
- **Especificar desempenho mínimo de processo:** confirma que o processo atingiu o desempenho exigido.
- **Exigir inspeção, teste ou monitoramento:** identifica atividade, agente competente e momento relevante.
- **Aplicar limite condicionalmente:** aplica o limite devido a característica do produto ou processo.
- **Definir limites alternativos:** seleciona o limite correspondente à categoria/condição da remessa.

## 10. Anexo 3: vocabulário e predicados

### 10.1 Categorias de sujeitos e objetos

O vocabulário ilustrativo organiza conceitos em grupos como:

- entidades analíticas e biológicas: análise, caso, doença, microrganismo, vírus, contaminante químico, perigo físico, pH, proteína;
- materiais, produtos e substâncias: lote, material, matéria-prima, substância, ingrediente, produto;
- processos e operações: processo, procedimento, tratamento, prevenção, condição, contaminação, emissão;
- teste e certificação: certificação, inspeção, teste, verificação, indicador, métrica;
- instalações, equipamentos e embalagem: instalação, equipamento, embalagem, selo;
- instituições, pessoas e funções;
- documentos, planos, políticas, programas, regulamentos e restrições;
- locais, territórios, tempo, comércio, transporte, retenção, idioma e rótulo.

### 10.2 Predicados

Os predicados devem representar estados, resultados ou ações concluídas, coerentes com a função factual da attestation. Exemplos do vocabulário incluem:

`accreditedBy`, `achieves`, `applies`, `approvedBy`, `approvedFor`, `authorizedBy`, `authorizedFor`, `carriedIn`, `certifiedFor`, `comesFrom`, `completedIn` e `compliesWith`.

O predicado escolhido deve ser semanticamente preciso, usado de forma consistente e compatível com os sujeitos, objetos e atributos definidos.

## 11. Roteiro de consulta rápida

Ao revisar uma attestation, seguir esta sequência:

1. Qual é o texto autoritativo e qual é o escopo da remessa?
2. Quantas unidades semânticas existem?
3. Quais são sujeito, predicado, objeto, condição, limite, tempo, local e agente?
4. Qual é a modalidade de origem?
5. Qual função comunicativa descreve melhor a declaração?
6. O texto é claro e consistente?
7. Cada assurance é objetiva e separadamente rastreável?
8. A conformidade pode ser observada, medida, testada ou auditada?
9. Os termos, unidades e relações são reutilizáveis entre sistemas?
10. A estrutura ou rewrite preserva integralmente significado, escopo, negações, exceções e limites?

## 12. Relação com outros textos Codex

O documento deve ser lido em conjunto com:

- **CXG 20-1995:** Principles for Food Import and Export Inspection and Certification;
- **CXG 26-1997:** Guidelines for the Design, Operation, Assessment and Accreditation of Food Import and Export Inspection and Certification Systems;
- **CXG 38-2001:** Guidelines for Design, Production, Issuance and Use of Generic Official Certificates.

O documento também cita trabalhos metodológicos sobre ontologias e compartilhamento de conhecimento, incluindo Gruber (1995) e Studer, Benjamins e Fensel (1998).

## 13. Limitações de interpretação

O resumo não deve ser usado para:

- criar novos requisitos sanitários;
- concluir validade jurídica ou aceitação regulatória;
- preencher limites, referências, evidências ou condições ausentes;
- substituir a revisão da autoridade competente;
- tratar a representação estruturada como substituta automática do texto humano autoritativo.
