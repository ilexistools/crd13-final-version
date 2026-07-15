# Base de conhecimento: avaliação de sanitary attestations

## 1. Finalidade

Esta base de conhecimento transforma os princípios do documento **Guidelines for Standardization of the Representation of Sanitary Attestations in Official Certificates**, versão fornecida pelo usuário (`Documents_Sanitary_requirements_representation_v17.pdf`), em conhecimento operacional para agentes de IA que:

- avaliam attestations sanitárias em certificados oficiais;
- identificam problemas de clareza, transparência, verificabilidade, interoperabilidade e preservação do significado;
- produzem instruções, achados e sugestões de melhoria sem alterar indevidamente o requisito regulatório.

O foco é a qualidade da representação da attestation. A avaliação **não determina** validade jurídica, correção científica, aceitabilidade política ou equivalência regulatória do requisito.

## 2. Conceitos fundamentais

### 2.1 Sanitary attestation

Declaração contida em um certificado oficial que confirma que requisitos de segurança dos alimentos foram atendidos.

### 2.2 Duas camadas da attestation

O agente deve separar:

1. **Origem normativa:** o tipo de requisito que deu origem à attestation, chamado de modalidade.
2. **Representação certificada:** a declaração de um fato verificado, como ação realizada, estado alcançado ou limite atendido.

Uma attestation é redigida como fato verificado, mesmo quando sua origem normativa é uma obrigação, proibição, permissão ou limite.

### 2.3 Modalidades

- **Obrigação:** algo que deveria ser feito ou alcançado.
- **Proibição:** algo que não é permitido.
- **Permissão:** algo que é permitido sob determinadas condições ou sem condição.
- **Limite/alvo:** parâmetro quantitativo ou mensurável a ser atendido.

A modalidade é metadado analítico; não deve ser inserida na attestation como `shall`, `must` ou `may` quando o certificado estiver declarando o fato ocorrido.

### 2.4 Função comunicativa

É a forma prática pela qual a intenção regulatória aparece na attestation. Ela refina a modalidade e orienta a estrutura da frase. Exemplos: confirmar uma ação ou estado, confirmar conformidade com um padrão, registrar uma inspeção, declarar ausência de substância, confirmar um limite quantitativo ou atribuir responsabilidade a um agente.

### 2.5 Unidade semântica

Uma unidade semântica é uma attestation ou conjunto de cláusulas que exerce uma única função comunicativa dentro de uma única modalidade. Se uma frase contém várias garantias independentes, ela deve ser dividida em unidades separadas.

### 2.6 Elementos essenciais

Ao interpretar uma attestation, identificar, no mínimo:

- sujeito: produto, lote, matéria-prima, processo, estabelecimento, autoridade ou outro agente;
- relação/predicado: foi tratado, vem de, cumpre, está livre de, foi inspecionado etc.;
- objeto/condição: perigo, substância, prática, padrão, limite ou resultado;
- commodity/produto e escopo da remessa;
- atividade ou processo regulado;
- qualificadores temporais e espaciais;
- condição, exceção, limite, unidade e referência normativa, quando houver.

## 3. Princípios e dependências

Os princípios A e B são fundacionais. C, D e E dependem de uma attestation já esclarecida e estruturada por A e B.

```text
A Clareza e Consistência ─┐
                           ├─> C Verificabilidade e Auditabilidade
B Transparência e          ├─> D Interoperabilidade
  Objetividade ────────────┘    E Preservação do Significado acompanha todos
```

Uma attestation que falha gravemente em A ou B não deve ser convertida diretamente em representação machine-readable: primeiro deve ser esclarecida e validada humanamente.

## 4. Conhecimento avaliável por unidade

As unidades abaixo são as unidades de avaliação do agente. A1-A3 compõem Clareza e Consistência; B1-B2 compõem Transparência e Objetividade; C, D e E são avaliados depois delas.

## A1 - Identificação da unidade semântica

### Conhecimento

Uma attestation deve ser tratada inicialmente como uma unidade semântica. Ela pode conter várias cláusulas somente quando todas realizam uma única função comunicativa dentro de uma única modalidade. Garantias independentes devem ser separadas.

### Avaliação

- Identifique cada assurance, ação, estado, condição ou resultado declarado.
- Verifique se há mais de uma modalidade ou função comunicativa na mesma frase.
- Mantenha juntas cláusulas que formam uma única assurance; divida cláusulas independentes.
- Registre a unidade original e, se necessário, as unidades propostas.

### Falhas típicas

- várias garantias ligadas por `e`, `com`, `incluindo` ou `bem como`;
- mistura de requisitos do produto, do estabelecimento e da autoridade;
- uma frase cuja divisão faria perder uma condição essencial;
- fragmentação que gera repetição, perda de contexto ou mudança de escopo.

### Teste

> Cada unidade pode ser validada, referenciada e reutilizada independentemente sem perder o sentido?

## A2 - Identificação dos elementos-chave

### Conhecimento

Os elementos-chave definem o escopo e a intenção: commodity/produto, perigo ou domínio de assurance, atividade/processo regulado e qualificadores temporais ou espaciais. Também devem ser considerados sujeito, predicado, objeto, condição, limite, agente e referência.

### Avaliação

- Identifique quem ou o que é o sujeito.
- Identifique a relação declarada e o objeto/condição correspondente.
- Identifique produto, remessa, lote, processo, estabelecimento ou agente aplicável.
- Extraia tempo, local, método, parâmetro, unidade, exceção e referência.
- Verifique se algum elemento necessário foi omitido ou se há elemento não essencial que amplia o requisito.

### Falhas típicas

- produto ou remessa não identificados;
- atividade sem contexto temporal ou espacial quando o contexto é material;
- condição ou exceção sem antecedente claro;
- mistura de perigo, processo e resultado sem relação explícita;
- inclusão de informação que não pertence ao escopo da assurance.

### Teste

> O agente consegue preencher sujeito, predicado, objeto, escopo e qualificadores sem inferir fatos externos?

## A3 - Modalidade, função comunicativa e formulação clara

### Conhecimento

A modalidade descreve a origem normativa: obrigação, proibição, permissão ou limite/alvo. A attestation, porém, deve declarar um fato verificado. A função comunicativa determina a forma adequada da declaração, como confirmar ação/estado, conformidade com padrão, precaução, responsabilidade, ausência, inspeção ou atendimento de limite.

### Avaliação

- Classifique a modalidade de origem ou marque `uncertain`.
- Identifique a função comunicativa mais específica.
- Verifique se a frase é direta, concisa, consistente e sem jargão desnecessário.
- Confirme que a terminologia é uniforme e compatível com vocabulários ou referências Codex aplicáveis.
- Verifique se não há ambiguidade de negação, escopo, pronome ou modificador.
- Verifique se a formulação evita `shall`, `must` e `may` quando a função é declarar o fato certificado.

### Falhas típicas

- modalidade normativa apresentada como se fosse o fato certificado;
- função comunicativa incompatível com a estrutura da frase;
- termos como `adequado`, `suficiente`, `apropriado` ou `devidamente` sem critério;
- termos diferentes para o mesmo conceito;
- frase longa, redundante ou com relações gramaticais ambíguas.

### Teste

> Um leitor independente entende quem fez o quê, qual estado foi alcançado, sob qual condição e dentro de qual escopo?

## B1 - Separação e estruturação para transparência

### Conhecimento

Separar attestations complexas em unidades bem definidas torna cada assurance compreensível, rastreável e individualmente validável. A separação também permite mapear cada unidade a uma referência, evidência e estrutura digital.

### Avaliação

- Separe condições, práticas, ações e assurances independentes.
- Verifique se cada unidade tem uma função comunicativa única.
- Preserve relações e contexto ao dividir.
- Para cada unidade, indique qual requisito e qual evidência devem ser avaliados.

### Falhas típicas

- uma frase que afirma condições higiênicas, GMP, SSOP, HACCP e verificação oficial sem separá-las;
- unidade que combina ação, resultado e auditoria como se fossem uma única prova;
- divisão que altera o sujeito ou faz uma condição parecer universal;
- duplicação ou perda de contexto ao quebrar a frase.

### Teste

> Cada assurance pode ser apontada, justificada, verificada e auditada separadamente?

## B2 - Objetividade, escopo e referências

### Conhecimento

A attestation deve expressar significado único em termos objetivos, observáveis ou mensuráveis. O leitor não deve depender de conhecimento implícito de práticas nacionais. Quando relevante, a attestation deve poder ser ligada a uma referência Codex ou outra fonte oficial que sustente sua intenção.

### Avaliação

- Identifique critério observável, mensurável ou documentável.
- Verifique se termos subjetivos têm critério, limiar, método ou referência.
- Confirme que produto, lote, processo, local, tempo, agente e remessa estão no escopo correto.
- Verifique se a referência normativa está identificada de modo suficiente.
- Avalie se autoridades importadora e exportadora chegariam à mesma interpretação.

### Falhas típicas

- `adequado`, `suficiente`, `apropriado` ou `satisfatório` sem definição;
- `normas vigentes`, `requisitos aplicáveis` ou `procedimentos usuais` sem referência identificável;
- ausência de método, resultado, agente, tempo ou local necessários à compreensão;
- dependência de prática nacional não declarada.

### Teste

> É possível apontar a evidência objetiva de cada unidade e a referência que justifica sua aplicação?

## C - Verificabilidade e Auditabilidade

### Definição

A attestation deve poder ser verificada e auditada, preferencialmente por termos observáveis ou mensuráveis e por uma estrutura que também possa ser validada em sistemas eletrônicos.

### Pré-condição

Avaliar C somente depois de A e B terem identificado uma unidade clara e objetiva. Uma frase ambígua não se torna verificável apenas por ser convertida em campos.

### O que avaliar

1. **Evento/estado verificável:** a declaração descreve ação concluída, estado atual, resultado ou conformidade demonstrável?
2. **Evidência:** que inspeção, teste, registro, certificado, medição, autoridade ou sistema poderia comprovar a declaração?
3. **Observabilidade/mensuração:** há critério, valor, unidade, método, data ou agente quando necessários?
4. **Auditabilidade:** um auditor consegue rastrear a declaração à evidência e repetir a avaliação?
5. **Estrutura:** os componentes podem ser representados como sujeito-predicado-objeto e atributos sem perda de contexto?
6. **Automação:** os campos têm valores suficientemente definidos para validação automática, quando isso for aplicável?

### Representação mínima

```text
SUJEITO ; PREDICADO ; OBJETO
```

Exemplo:

```text
PRODUCT ; COMES_FROM ; FACILITY #type(Establishment)
FACILITY #type(Establishment) ; IMPLEMENTS ; PRACTICE #type(GMP)
```

### Sinais de não conformidade

- ausência de critério de aceitação;
- declaração de conformidade sem dizer com qual padrão ou limite;
- valor quantitativo sem unidade, método ou contexto;
- evidência impossível de identificar ou relacionar à remessa;
- predicado que mistura múltiplas relações;
- campos estruturados que não representam todas as cláusulas da attestation.

### Teste operacional

> Um inspetor ou sistema consegue determinar quais dados devem ser consultados, qual comparação deve ser feita e qual resultado constitui conformidade?

### Ação recomendada

Indicar evidência e critério de verificação. Gerar triplas apenas para uma attestation já esclarecida. Se a frase não permitir determinar o que seria prova, marcar a lacuna em vez de preencher com suposição.

## D - Interoperabilidade

### Definição

A linguagem estruturada e harmonizada deve permitir que autoridades e sistemas diferentes troquem, comparem e interpretem a attestation de forma consistente.

### O que avaliar

1. **Vocabulário controlado:** conceitos importantes usam termos preferidos e estáveis?
2. **Semântica compartilhada:** os predicados têm relações bem definidas e não ambíguas?
3. **Sintaxe:** a estrutura de representação segue convenções consistentes?
4. **Normalização:** entidades conceituais foram separadas de categorias e atributos?
5. **Predicados afirmativos:** a representação expressa estados, resultados ou ações concluídas, em vez de reproduzir construções normativas?
6. **Unidades e formatos:** parâmetros quantitativos usam unidades reconhecidas e formato padronizado?
7. **Reutilização:** a mesma relação pode ser comparada ou reutilizada em outros certificados sem depender do texto local?

### Regras de normalização do documento

- substituir entidade conceitual pela categoria quando apropriado: `Milk` -> `Product`;
- representar especificidade como atributo: `Product #type(Milk)`;
- usar forma de dicionário: `Products` -> `Product`;
- substituir sinônimos pelo termo preferido: `must be obtained` -> `comesFrom`;
- usar predicado em forma de attestation afirmativa: `does not contain` -> `freeFrom`, quando o vocabulário adotado assim definir.

### Sinais de não conformidade

- sinônimos, pluralizações ou grafias diferentes para o mesmo conceito;
- predicados inventados, sem definição ou usados com sentidos diferentes;
- mistura de frase normativa e fato certificado;
- unidades locais ou formatos ambíguos;
- categoria e instância misturadas no mesmo campo;
- estrutura que não pode ser comparada entre plataformas.

### Teste operacional

> Outro sistema, usando o vocabulário e a estrutura definidos, recuperaria a mesma entidade, relação, condição e resultado?

### Ação recomendada

Normalizar somente depois de preservar o texto autoritativo. Registrar mapeamentos, termos preferidos, atributos e unidades. Se não houver vocabulário controlado disponível, marcar a decisão como provisória e explicar a incerteza.

## E - Preservação do Significado

### Definição

A representação estruturada não pode alterar a substância, o escopo ou a intenção regulatória da attestation. Ela deve ser legalmente equivalente ao texto humano autoritativo.

### O que avaliar

1. **Equivalência semântica:** a representação diz exatamente o mesmo que a attestation?
2. **Escopo:** sujeito, produto, remessa, tempo, local, condição e exceções foram preservados?
3. **Modalidade de origem:** a modalidade e a função comunicativa continuam coerentes?
4. **Negação e limites:** nenhuma negação, exceção, comparação, limiar ou unidade foi invertida ou omitida?
5. **Intenção regulatória:** a estrutura não transformou uma obrigação em permissão, uma recomendação em proibição, ou um limite em ausência absoluta?
6. **Validação humana:** existe revisão humana antes de a estrutura substituir ou alimentar a attestation oficial?

### Sinais de não conformidade

- paráfrase que amplia ou restringe o requisito;
- remoção de exceções ou condições;
- perda do agente responsável ou do vínculo temporal/espacial;
- conversão de `não excede X` em `livre de`;
- conversão de `quando aplicável` em regra universal;
- inferência de fatos não presentes no texto;
- estrutura machine-readable tratada como substituta automática do texto autoritativo.

### Teste operacional

> Um especialista, comparando texto e estrutura, reconheceria a mesma obrigação regulatória, o mesmo escopo e o mesmo resultado certificado?

### Ação recomendada

Fazer comparação bidirecional: cada elemento do texto deve aparecer na estrutura e cada elemento da estrutura deve ser justificável pelo texto. Quando houver dúvida, preservar o texto e marcar `revisão humana necessária`.

## 5. Ordem recomendada de avaliação

1. Delimitar a attestation e o escopo da remessa.
2. Identificar unidades semânticas.
3. Extrair sujeito, predicado, objeto, condições, qualificadores, limites e referências.
4. Identificar modalidade e função comunicativa.
5. Avaliar A1, A2, A3, B1 e B2.
6. Se A1-A3 e B1-B2 forem suficientes, avaliar C e D.
7. Comparar qualquer estrutura ou rewrite com o texto original para avaliar E.
8. Produzir achados separados, com evidência textual e correção proporcional.
9. Fazer revisão humana quando houver impacto de escopo, modalidade, negação, exceção ou equivalência regulatória.

## 6. Escala de severidade sugerida

- **critical:** risco claro de alterar ou não conseguir determinar a intenção/escopo regulatório; não liberar para uso.
- **major:** a interpretação ou verificação diverge entre autoridades, ou a estrutura omite informação material.
- **minor:** problema localizado de terminologia, formato ou explicitação que não altera o significado, mas reduz consistência.
- **info:** observação ou oportunidade de melhoria sem falha demonstrada.

Severidade deve ser justificada pelo risco para significado, escopo, interpretação ou verificação, não pelo tamanho da frase.

## 7. Regras de não extrapolação

- Não avaliar validade jurídica, suficiência científica ou política comercial sem instrução específica e fontes apropriadas.
- Não criar valores, limites, unidades, referências, autoridades, evidências ou commodities ausentes no texto.
- Não reescrever silenciosamente: diferenciar texto original, análise, sugestão e representação estruturada.
- Não penalizar a ausência de digitalização quando o objetivo for apenas a attestation humana; C e D podem ser `não demonstrado`.
- Não dividir uma frase se as cláusulas formarem uma única assurance e a divisão causar perda de contexto.

## 8. Formato de saída recomendado

```json
{
  "attestation_original": "...",
  "scope": {
    "commodity": "...",
    "consignment": "...",
    "other_qualifiers": []
  },
  "semantic_units": [
    {
      "text": "...",
      "modality": "obligation|prohibition|permission|limit|uncertain",
      "communicative_function": "..."
    }
  ],
  "principles": {
    "A1_semantic_unit": {
      "status": "pass|partial|fail|not_assessable",
      "findings": []
    },
    "A2_key_elements": {
      "status": "pass|partial|fail|not_assessable",
      "findings": []
    },
    "A3_modality_function_clarity": {
      "status": "pass|partial|fail|not_assessable",
      "findings": []
    },
    "B1_separation_structure": {
      "status": "pass|partial|fail|not_assessable",
      "findings": []
    },
    "B2_objectivity_scope_references": {
      "status": "pass|partial|fail|not_assessable",
      "findings": []
    },
    "C_verifiability_auditability": {
      "status": "pass|partial|fail|not_assessable",
      "findings": []
    },
    "D_interoperability": {
      "status": "pass|partial|fail|not_assessable",
      "findings": []
    },
    "E_preservation_of_meaning": {
      "status": "pass|partial|fail|not_assessable",
      "findings": []
    }
  },
  "recommended_action": "accept|clarify|split|rewrite_and_human_validate|do_not_structure_yet",
  "human_validation_required": true
}
```

Cada finding deve conter, no mínimo: `severity`, `principle`, `evidence`, `issue`, `impact`, `recommendation` e `confidence`.

## 9. Referência do documento-fonte

- Documento: *Guidelines for Standardization of the Representation of Sanitary Attestations in Official Certificates*.
- Arquivo analisado: `Documents_Sanitary_requirements_representation_v17.pdf`.
- Seções centrais: Section 3 (Definitions), Section 4 (Principles), Section 5 (Essential Criteria), Section 6 (Human-readable Attestations), Annex I (Machine-readable Attestations), Annex 2 (Communicative Functions) e Annex 3 (Vocabulary Standardisation).
