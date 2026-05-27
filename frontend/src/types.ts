export type TipoAssembleia = "AGE" | "AGO" | "RCF" | "STD" | "RII" | "RTD";
export type Criticidade = "Alto" | "Medio" | "Baixo";
export type ChecklistStatus = "A fazer" | "Em andamento" | "Concluído";

export interface ChecklistItem {
  titulo: string;
  responsavel: string;
  prazo: string;
  status: ChecklistStatus;
}

export interface Assembleia {
  id: string;
  createdAt: string;
  data: string;
  tipo: TipoAssembleia;
  ordemDoDia: string;
  dataLimiteEdital: string;
  suporteCsi: string;
  editalEnviado: boolean;
  apresentacao: string;
  dptosEnvolvidos: string;
  spe: string;
  criticidade: Criticidade;
  responsavel: string;
  checklist: ChecklistItem[];
  checklistPos: ChecklistItem[];
}

export type AssembleiaInput = Omit<
  Assembleia,
  "id" | "createdAt" | "checklist" | "checklistPos"
>;

export type DepartamentoSolicitante = "Engenharia" | "Financeiro" | "Jurídico" | "PMO" | "Outros";
export type SolicitacaoStatus = "Pendente de análise" | "Em análise" | "Aprovada" | "Rejeitada";

export interface DocumentoUpload {
  ordemDoDia: string;
  nomeDocumento: string;
  filename: string;
  originalName: string;
  mimetype: string;
  size: number;
}

export interface Indicacao {
  ordemDoDia: string;
  campo: string;
  valor: string;
}

export interface Solicitacao {
  id: string;
  createdAt: string;
  nomeSolicitante: string;
  departamentoSolicitante: DepartamentoSolicitante;
  spe: string;
  dataPretendida: string;
  tipo: TipoAssembleia;
  ordensDoDia: string[];
  outraOrdemDescricao: string;
  observacoes: string;
  documentos: DocumentoUpload[];
  indicacoes: Indicacao[];
  status: SolicitacaoStatus;
}

// Catálogo de quóruns previstos no Código Civil
export type QuorumStatus =
  | "Unanimidade"
  | "Maioria absoluta"
  | "Maioria simples"
  | "Destituição administrador-sócio"
  | "Exclusão extrajudicial"
  | "A verificar";

export const QUORUM_VALORES: QuorumStatus[] = [
  "Unanimidade",
  "Maioria absoluta",
  "Maioria simples",
  "Destituição administrador-sócio",
  "Exclusão extrajudicial",
  "A verificar",
];

export interface QuorumInfo {
  key: QuorumStatus;
  titulo: string;
  resumo: string;
  materias: string[];
  baseLegal?: string;
}

export const QUORUM_CATALOGO: Record<QuorumStatus, QuorumInfo> = {
  Unanimidade: {
    key: "Unanimidade",
    titulo: "Unanimidade (100% do capital social)",
    resumo: "Exige aprovação de todos os sócios.",
    materias: [
      "Designação de administrador não sócio quando o capital social não está totalmente integralizado",
    ],
    baseLegal: "art. 1.061, CC",
  },
  "Maioria absoluta": {
    key: "Maioria absoluta",
    titulo: "Maioria absoluta — mais de 50% do capital social",
    resumo: "Mais de 50% do capital social (não dos presentes).",
    materias: [
      "Modificação do contrato social (antes era 3/4)",
      "Incorporação, fusão, dissolução da sociedade ou cessação do estado de liquidação",
      "Designação de administradores em ato separado do contrato",
      "Destituição de administradores",
      "Modo de remuneração dos administradores, quando não fixado no contrato",
      "Pedido de recuperação judicial",
    ],
    baseLegal: "art. 1.076, I e II c/c art. 1.071, CC — LC 155/2016",
  },
  "Maioria simples": {
    key: "Maioria simples",
    titulo: "Maioria simples — mais da metade dos presentes",
    resumo: "Mais da metade dos votos dos sócios presentes.",
    materias: [
      "Aprovação das contas da administração",
      "Nomeação e destituição de liquidantes e julgamento de suas contas",
      "Demais matérias indicadas na lei ou no contrato, se este não exigir maioria mais elevada",
    ],
    baseLegal: "art. 1.076, III c/c art. 1.071, I, CC",
  },
  "Destituição administrador-sócio": {
    key: "Destituição administrador-sócio",
    titulo: "Destituição de sócio administrador nomeado no contrato",
    resumo:
      "Desde a LC 155/2016 exige maioria absoluta (>50% do capital), salvo disposição contratual diversa. Antes era 2/3.",
    materias: ["Destituição de sócio administrador nomeado no contrato social"],
    baseLegal: "art. 1.063, §1º, CC",
  },
  "Exclusão extrajudicial": {
    key: "Exclusão extrajudicial",
    titulo: "Exclusão de sócio por justa causa (extrajudicial)",
    resumo:
      "Maioria do capital social remanescente (excluído o sócio a ser excluído), e desde que prevista no contrato social.",
    materias: ["Exclusão extrajudicial de sócio por falta grave"],
    baseLegal: "art. 1.085, CC",
  },
  "A verificar": {
    key: "A verificar",
    titulo: "A verificar",
    resumo: "Quórum ainda não definido para essa deliberação.",
    materias: [],
  },
};

export interface RoteiroFormulario {
  linkApresentacao: string;
  presidente: string;
  secretario: string;
  quorum: QuorumStatus;
  observacoes: string;
}

export interface Roteiro {
  assembleiaId: string;
  formulario: RoteiroFormulario;
  roteiro: string;
  geradoEm: string;
}

export interface Relatorio {
  assembleiaId: string;
  transcricao: string;
  relatorio: string;
  geradoEm: string;
}

export interface SocioProcuracao {
  nome: string;
  percentualCapital: number;
  temProcuracaoValida: boolean;
  outorgado: string;
}

export interface Procuracao {
  id: string;
  spe: string;
  codigoSpe: string;
  responsavel: string;
  contato: string;
  linkAcs: string;
  socios: SocioProcuracao[];
  possuiProcuracao: boolean | null;
  observacoes: string;
}

export const TIPOS: TipoAssembleia[] = ["AGE", "AGO", "RCF", "STD", "RII", "RTD"];
export const CRITICIDADES: Criticidade[] = ["Alto", "Medio", "Baixo"];
export const STATUS_CHECKLIST: ChecklistStatus[] = ["A fazer", "Em andamento", "Concluído"];
export const DEPARTAMENTOS: DepartamentoSolicitante[] = [
  "Engenharia",
  "Financeiro",
  "Jurídico",
  "PMO",
  "Outros",
];

export const TIPO_DESCRICAO: Record<TipoAssembleia, string> = {
  AGE: "Assembleia Geral Extraordinária",
  AGO: "Assembleia Geral Ordinária",
  RCF: "Reunião do Conselho Fiscal",
  STD: "Sessão Tira Dúvidas",
  RII: "Reunião Investidor",
  RTD: "Reunião Técnica/Deliberativa",
};

export function temEdital(tipo: TipoAssembleia): boolean {
  return tipo === "AGE" || tipo === "AGO";
}

export const SPES_DISPONIVEIS: string[] = [
  "Barra Grande Spot",
  "Barra Spot",
  "Bonito Spot",
  "Bonito Spot II",
  "Campeche Spot",
  "Canas Beach Spot",
  "Canasvieiras Spot",
  "Caraguá Spot",
  "Foz Spot",
  "Ilha do Campeche Spot",
  "Imbassaí",
  "Ingleses Spot",
  "Itacaré Spot",
  "Japaratinga Spot",
  "Jurerê Beach Spot",
  "Jurerê Spot II",
  "Novo Campeche Spot",
  "Rosa Norte Spot",
  "Rosa Sul Spot",
  "Santo Antônio Spot",
  "Sul da Ilha Spot",
  "Trancoso Spot",
  "Urubici Spot",
  "Urubici Spot II",
];

export const ORDENS_DO_DIA: string[] = [
  "Chamada de capital",
  "Alteração de projeto",
  "Apresentação do orçamento executivo",
  "Eleição do Conselho Fiscal",
  "Reeleição do Conselho Fiscal",
  "Acompanhamento do andamento do empreendimento",
  "AGE de Entrega",
  "Aprovação de Contas",
  "Exclusão extrajudicial de sócio (art. 1.085 CC)",
  "Outro (especificar)",
];

// Pautas que exigem atenção jurídica especial — exibem aviso amarelo no form
export const PAUTAS_CRITICAS = new Set<string>([
  "Exclusão extrajudicial de sócio (art. 1.085 CC)",
]);

export const AVISO_PAUTA_CRITICA: Record<string, string> = {
  "Exclusão extrajudicial de sócio (art. 1.085 CC)":
    "⚠️ Deliberação crítica. Procedimento do art. 1.085 CC exige: (i) cláusula contratual prévia autorizando a exclusão extrajudicial; (ii) notificação ao sócio com antecedência mínima de 30 dias e direito de defesa; (iii) edital publicado em jornal de grande circulação por 2 vezes; (iv) aprovação por maioria do capital social remanescente. Antes de marcar essa pauta, alinhe com o Jurídico.",
};

export const ORDEM_LABEL_COMPLETO: Record<string, string> = {
  "Acompanhamento do andamento do empreendimento":
    "Acompanhamento do andamento do empreendimento: (i) Situação Financeira; (ii) Situação das Aprovações e Projetos",
};

export type CampoTipo = "upload" | "texto";

export interface CampoConfig {
  tipo: CampoTipo;
  nome: string;
  obrigatorio: boolean;
  label?: string;
  ajuda?: string;
}

export interface PautaConfig {
  campos: CampoConfig[];
  avisoAmarelo?: string;
}

// Documentos indispensáveis (só informativo — sem upload no form público)
// Pautas sem entrada aqui não exibem a seção (ex.: Reeleição CF não precisa de docs)
export const DOCUMENTOS_INDISPENSAVEIS: Record<string, string[]> = {
  "Chamada de capital": [
    "Demonstrativo financeiro",
    "Justificativa assinada pela construtora com os motivos da chamada",
    "Orçamento executivo",
  ],
  "Alteração de projeto": [
    "Justificativas da prefeitura",
    "Memorial descritivo",
    "Projeto antes × depois dos ajustes",
  ],
  "Apresentação do orçamento executivo": [
    "Planilha de orçamento executivo",
  ],
  "Eleição do Conselho Fiscal": [
    "Lista de sócios com qualificação completa",
  ],
  "Acompanhamento do andamento do empreendimento": [
    "Resumo com todos os itens (situação financeira + situação das aprovações e projetos)",
  ],
  "AGE de Entrega": [
    "Habite-se",
    "AVCB",
    "Manual do proprietário",
  ],
  "Aprovação de Contas": [
    "Balanço patrimonial",
    "DRE",
    "Relatório do auditor",
  ],
  "Exclusão extrajudicial de sócio (art. 1.085 CC)": [
    "Cláusula contratual autorizando a exclusão extrajudicial",
    "Notificação prévia ao sócio (mínimo 30 dias) com prazo de defesa",
    "Comprovantes de publicação do edital em jornal de grande circulação (2 vezes)",
    "Parecer jurídico fundamentando a justa causa",
    "Lista de sócios com percentual de capital remanescente",
  ],
};

// Mantido legado (estrutura ainda usada em outros pontos da app, se houver).
// Form público novo usa DOCUMENTOS_INDISPENSAVEIS.
export const DOCUMENTOS_POR_ORDEM: Record<string, PautaConfig> = {};

export const UPLOAD_ACCEPT = ".pdf,.doc,.docx,.xls,.xlsx,.jpg,.jpeg,.png";
export const UPLOAD_MAX_BYTES = 10 * 1024 * 1024;

export const PONTOS_FOCAIS: { area: string; pessoa: string }[] = [
  { area: "CSI", pessoa: "Luiza" },
  { area: "Engenharia", pessoa: "Francisco" },
  { area: "PMO", pessoa: "Cris" },
  { area: "Financeiro", pessoa: "Rafa" },
];
