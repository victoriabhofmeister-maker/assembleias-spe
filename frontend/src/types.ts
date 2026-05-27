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
}

export type AssembleiaInput = Omit<Assembleia, "id" | "createdAt" | "checklist">;

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

export type QuorumStatus = "Atingido" | "Não atingido" | "A verificar";
export const QUORUM_VALORES: QuorumStatus[] = ["Atingido", "Não atingido", "A verificar"];

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
  STD: "Subscrição/Transferência de Direitos",
  RII: "Reunião de Investidores/Incorporadores",
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
  "Alteração contratual",
  "Outro (especificar)",
];

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
export const DOCUMENTOS_INDISPENSAVEIS: Record<string, string[]> = {
  "Chamada de capital": [
    "Laudo de avaliação atualizado",
    "Demonstrativo financeiro",
  ],
  "Alteração de projeto": [
    "Projeto atualizado aprovado",
    "Memorial descritivo",
  ],
  "Apresentação do orçamento executivo": [
    "Planilha de orçamento executivo",
  ],
  "Eleição do Conselho Fiscal": [
    "Lista de sócios com qualificação completa",
  ],
  "Reeleição do Conselho Fiscal": [
    "Lista de sócios com qualificação completa",
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
  "Alteração contratual": [
    "Minuta da alteração contratual",
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
