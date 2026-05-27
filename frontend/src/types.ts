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
  "Urubici Spot II",
];

export const ORDENS_DO_DIA: string[] = [
  "Chamada de capital",
  "Alteração de projeto",
  "Apresentação do orçamento executivo",
  "Eleição do Conselho Fiscal",
  "Acompanhamento do andamento do empreendimento",
  "AGE de Entrega",
  "Aprovação de Contas",
  "Reeleição do Conselho Fiscal",
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

export const DOCUMENTOS_POR_ORDEM: Record<string, PautaConfig> = {
  "Chamada de capital": {
    campos: [
      { tipo: "upload", nome: "Memória de cálculo da chamada", obrigatorio: true },
      { tipo: "upload", nome: "Extrato bancário da SPE", obrigatorio: true },
    ],
  },
  "Alteração de projeto": {
    campos: [
      { tipo: "upload", nome: "Projeto aprovado pelo órgão competente", obrigatorio: true },
      { tipo: "upload", nome: "Memorial descritivo das alterações", obrigatorio: true },
    ],
  },
  "Apresentação do orçamento executivo": {
    campos: [
      { tipo: "upload", nome: "Planilha de orçamento executivo", obrigatorio: true },
      { tipo: "upload", nome: "Cronograma físico-financeiro", obrigatorio: true },
    ],
  },
  "Eleição do Conselho Fiscal": {
    campos: [
      {
        tipo: "texto",
        nome: "Candidato indicado",
        obrigatorio: false,
        label: "Candidato indicado (nome completo) — se já houver indicação prévia",
        ajuda: "A eleição pode ocorrer em assembleia mesmo sem indicação prévia.",
      },
    ],
  },
  "Acompanhamento do andamento do empreendimento": {
    campos: [
      { tipo: "upload", nome: "Relatório financeiro do período", obrigatorio: true },
      { tipo: "upload", nome: "Relatório de andamento das aprovações e projetos", obrigatorio: true },
    ],
  },
  "AGE de Entrega": {
    campos: [
      { tipo: "upload", nome: "Convenção de Condomínio", obrigatorio: true },
      { tipo: "upload", nome: "Regimento Interno", obrigatorio: true },
      { tipo: "upload", nome: "Minuta da ata de entrega", obrigatorio: true },
      {
        tipo: "upload",
        nome: "Outros documentos relevantes para a entrega",
        obrigatorio: false,
        label: "Demais documentos de entrega",
      },
    ],
    avisoAmarelo:
      "⚠️ Documentos podem variar conforme o estágio do empreendimento. Em caso de dúvida, consulte o time Jurídico antes de enviar.",
  },
  "Aprovação de Contas": {
    campos: [
      { tipo: "upload", nome: "Demonstrativo financeiro do exercício", obrigatorio: true },
      { tipo: "upload", nome: "Balancete assinado pelo contador", obrigatorio: true },
      { tipo: "upload", nome: "Parecer do Conselho Fiscal", obrigatorio: false },
    ],
  },
  "Reeleição do Conselho Fiscal": {
    campos: [
      {
        tipo: "texto",
        nome: "Candidatos indicados para reeleição",
        obrigatorio: false,
        label: "Candidatos indicados para reeleição (nomes completos)",
      },
      { tipo: "upload", nome: "Ata da última eleição do Conselho Fiscal", obrigatorio: true },
    ],
  },
  "Outro (especificar)": {
    campos: [
      {
        tipo: "upload",
        nome: "Documentos de apoio",
        obrigatorio: false,
        label: "Documentos de apoio (opcional)",
      },
    ],
  },
};

export const UPLOAD_ACCEPT = ".pdf,.doc,.docx,.xls,.xlsx,.jpg,.jpeg,.png";
export const UPLOAD_MAX_BYTES = 10 * 1024 * 1024;

export const PONTOS_FOCAIS: { area: string; pessoa: string }[] = [
  { area: "CSI", pessoa: "Luiza" },
  { area: "Engenharia", pessoa: "Francisco" },
  { area: "PMO", pessoa: "Cris" },
  { area: "Financeiro", pessoa: "Rafa" },
];
