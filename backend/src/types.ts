export type TipoAssembleia = "AGE" | "AGO" | "RCF" | "STD" | "RII" | "RTD";
export type Criticidade = "Alto" | "Medio" | "Baixo";
export type ChecklistStatus = "A fazer" | "Em andamento" | "Concluído";

// Estágios do kanban (campo salvo). Quando ausente, o front deriva pelo estado.
export type EtapaKanban =
  | "a_elaborar"
  | "documentos_faltantes"
  | "em_elaboracao"
  | "aprazado"
  | "apresentacao"
  | "edital_enviado"
  | "realizada";

export const ETAPAS_KANBAN: EtapaKanban[] = [
  "a_elaborar",
  "documentos_faltantes",
  "em_elaboracao",
  "aprazado",
  "apresentacao",
  "edital_enviado",
  "realizada",
];

export interface ChecklistItem {
  titulo: string;
  responsavel: string;
  prazo: string;
  status: ChecklistStatus;
  // SLA em dias corridos a partir da entrada do card (createdAt). Opcional.
  slaDays?: number;
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
  // Link do edital (coluna "Link Edital" do cronograma).
  linkEdital: string;
  // Situação da assembleia (coluna "Situação da Assembleia": ex. cancelada, realizada).
  situacao: string;
  // Observações livres (coluna "Observações" do cronograma).
  observacoes: string;
  // Comentários internos livres (editável no detalhe do card).
  comentarios?: string;
  // Estágio do kanban (arrastável). Ausente = derivado pelo front.
  etapa?: EtapaKanban;
  // Quando a assembleia nasceu de uma solicitação do formulário, guarda o id dela
  // (para acessar os anexos/dados de origem).
  solicitacaoOrigemId?: string;
  checklist: ChecklistItem[];
  checklistPos: ChecklistItem[];
}

export type AssembleiaInput = Omit<Assembleia, "id" | "createdAt" | "checklist" | "checklistPos">;

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

export type QuorumStatus =
  | "Unanimidade"
  | "Maioria absoluta"
  | "Maioria simples"
  | "Destituição administrador-sócio"
  | "Exclusão extrajudicial"
  | "A verificar";

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

export const TIPO_POR_EXTENSO: Record<string, string> = {
  AGE: "Assembleia Geral Extraordinária",
  RCF: "Reunião do Conselho Fiscal",
  STD: "Reunião Standard",
  RII: "Reunião Informativa Interna",
  RTD: "Reunião de Tira-Dúvidas",
};

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

export const CHECKLIST_TEMPLATE: ChecklistItem[] = [
  {
    titulo: "Elaborar apresentação da assembleia",
    responsavel: "Jurídico",
    prazo: "D+2",
    slaDays: 2,
    status: "A fazer",
  },
  {
    titulo: "Comunicar documentos faltantes",
    responsavel: "Jurídico",
    prazo: "D+3",
    slaDays: 3,
    status: "A fazer",
  },
  {
    titulo: "Convocar a assembleia (prazo mínimo 10 dias)",
    responsavel: "Jurídico",
    prazo: "D+4 (1 dia após comunicar documentos)",
    slaDays: 4,
    status: "A fazer",
  },
];

// Checklist pós-assembleia (executado após a realização)
export const CHECKLIST_POS_TEMPLATE: ChecklistItem[] = [
  {
    titulo: "Enviar comunicado/resumo no Slack",
    responsavel: "Jurídico",
    prazo: "Até 24h após a assembleia",
    status: "A fazer",
  },
  {
    titulo: "Enviar ata elaborada no WhatsApp para o grupo com o conselho",
    responsavel: "Jurídico",
    prazo: "Até 72h após a assembleia",
    status: "A fazer",
  },
  {
    titulo: "Enviar ata para validação dos investidores",
    responsavel: "Jurídico",
    prazo: "3 dias úteis para validação",
    status: "A fazer",
  },
  {
    titulo: "Abrir suporte no CSI para assinatura da ata pelos investidores",
    responsavel: "Jurídico + CSI",
    prazo: "Até 48h após término da validação",
    status: "A fazer",
  },
];

// Títulos legados (etapas que foram removidas em refatorações anteriores).
// O filtro em storage.ts/migrateChecklist remove silenciosamente esses títulos
// dos checklists carregados — mantendo compatibilidade com assembleias antigas.
export const CHECKLIST_LEGACY_TITLES = new Set<string>([
  "Receber solicitação via Pipe",
  "Envio no canal ASSEMBLEIAS (Slack)",
  "Análise da pauta e verificação de deliberações críticas",
  // Removidas em jun/2026 (simplificação do fluxo pré-assembleia):
  "Comunicar o PMO da solicitação",
  "Agendar reunião prévia de alinhamento",
  "Realizar reunião prévia de alinhamento",
]);

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

export const PROCURACOES_INICIAIS: Pick<Procuracao, "spe" | "codigoSpe" | "responsavel">[] = [
  { spe: "Barra Grande Spot", codigoSpe: "036-5510", responsavel: "Sabrina" },
  { spe: "Barra Spot", codigoSpe: "007-268", responsavel: "Victoria" },
  { spe: "Bonito Spot", codigoSpe: "030-5316", responsavel: "Sabrina" },
  { spe: "Bonito Spot II", codigoSpe: "034-5941", responsavel: "Mariele" },
  { spe: "Campeche Spot", codigoSpe: "015-2595", responsavel: "Sabrina" },
  { spe: "Canas Beach Spot", codigoSpe: "039-3800", responsavel: "Mariele" },
  { spe: "Canasvieiras Spot", codigoSpe: "017-2798", responsavel: "Sabrina" },
  { spe: "Caraguá Spot", codigoSpe: "033-3780", responsavel: "Victoria" },
  { spe: "Foz Spot", codigoSpe: "038-5379", responsavel: "Victoria" },
  { spe: "Ilha do Campeche Spot", codigoSpe: "018-2865", responsavel: "Sabrina" },
  { spe: "Ingleses Spot", codigoSpe: "009-384", responsavel: "Victoria" },
  { spe: "Itacaré Spot", codigoSpe: "035-5624", responsavel: "Mariele" },
  { spe: "Japaratinga Spot", codigoSpe: "011-584", responsavel: "Mariele" },
  { spe: "Jurerê Beach Spot", codigoSpe: "024-2811", responsavel: "Victoria" },
  { spe: "Jurerê Spot II", codigoSpe: "032-5693", responsavel: "Sabrina" },
  { spe: "Novo Campeche Spot", codigoSpe: "041-7094", responsavel: "Sabrina" },
  { spe: "Rosa Norte Spot", codigoSpe: "019-3096", responsavel: "Sabrina" },
  { spe: "Rosa Sul Spot", codigoSpe: "008-55", responsavel: "Victoria" },
  { spe: "Santo Antônio Spot", codigoSpe: "027-3656", responsavel: "Sabrina" },
  { spe: "Sul da Ilha Spot", codigoSpe: "021-3535", responsavel: "Mariele" },
  { spe: "Trancoso Spot", codigoSpe: "013-1634", responsavel: "Mariele" },
  { spe: "Urubici Spot II", codigoSpe: "016-2585", responsavel: "Mariele" },
];
