/** Périmètre fermé : 18 exports CSV UTF-8 reliés par la page officielle CE. */
export const DGAL_PAGE = "https://agriculture.gouv.fr/liste-des-etablissements-agrees-ce-conformement-au-reglement-ce-ndeg8532004-lists-ue-approved";
export const DGAL_BASE = "https://fichiers-publics.agriculture.gouv.fr/dgal/ListesOfficielles/";
export const DGAL_SECTIONS = [
  { code: "0", label: "Activités générales", file: "SSA1_ACTIV_GEN.txt" },
  { code: "I", label: "Viandes d’ongulés domestiques", file: "SSA1_VIAN_ONG_DOM.txt" },
  { code: "II", label: "Viandes de volailles et lagomorphes", file: "SSA1_VIAN_COL_LAGO.txt" },
  { code: "III", label: "Viandes de gibier d’élevage", file: "SSA1_VIAN_GIB_ELEV.txt" },
  { code: "IV", label: "Viandes de gibier sauvage", file: "SSA1_VIAN_GIB_SAUV.txt" },
  { code: "V", label: "Viandes hachées, préparations et VSM", file: "SSA1_VIAND_HACHE_VSM.txt" },
  { code: "VI", label: "Produits à base de viande", file: "SSA4_AGSANPROBASEVDE_PRV.txt" },
  { code: "VII", label: "Mollusques bivalves vivants", file: "SSA4B_AS_CE_PRODCOQUI_COV.txt" },
  { code: "VIII", label: "Produits de la pêche", file: "SSA4B_AS_CE_PRODPECHE_COV.txt" },
  { code: "IX", label: "Lait et produits laitiers", file: "SSA1_LAIT.txt" },
  { code: "X", label: "Œufs et ovoproduits", file: "SSA1_OEUF.txt" },
  { code: "XI", label: "Cuisses de grenouille et escargots", file: "SSA1_GREN_ESCARG.txt" },
  { code: "XII", label: "Graisses animales fondues et cretons", file: "SSA4_AGSANGREXPR_PRV.txt" },
  { code: "XIII", label: "Estomacs, vessies et boyaux traités", file: "SSA4_AGR_ESVEBO_PRV.txt" },
  { code: "XIV", label: "Gélatine", file: "SSA4_AGSANGELAT_PRV.txt" },
  { code: "XV", label: "Collagène", file: "SSA4_AGSANCOLL_PRV.txt" },
  { code: "XVI", label: "Produits hautement raffinés", file: "SSA_PROD_RAFF.txt" },
  { code: "RC", label: "Cuisines centrales", file: "SSA4_ASCCC_PRV.txt" },
] as const;
export const DGAL_CODES = ["AH", "CC", "CP", "CS", "CUISCEN", "DC", "EPC", "FFPP", "FV", "GHE", "LEP", "MM", "MP", "MSFP", "MSM", "PC", "PP", "RW", "SH", "WM", "ZV", "ZVB"] as const;
// Les exports réels mélangent points, tirets et identifiants compacts ; Corse
// et DOM inclus. Conserver la valeur exacte, sans la corriger ni la rapprocher.
export const DGAL_APPROVAL = /^(?:FR[- .]?)?(?:\d{2,3}|2[AB])(?:[.\-]?\d){4,9}[.]?(?:[- .]?CE)?$/;
export const dgalSection = (code: string) => DGAL_SECTIONS.find(s => s.code === code);
