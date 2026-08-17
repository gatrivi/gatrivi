export type ProspectPlatform='instagram'|'facebook'|'other';
export type ProspectCategory='gastronomia'|'pizzeria'|'rotiseria'|'cafeteria'|'panaderia'|'polleria'|'verduleria'|'libreria'|'grafica'|'distribuidora-lacteos'|'molino-mayorista'|'almacen'|'dietetica'|'petshop';
export type ProspectColor='carbon'|'coral'|'verde'|'azul'|'violeta';

export interface ProspectSignals {
  runningAds:boolean;
  weakOrNoStore:boolean;
  dmCheckout:boolean;
  strongVisuals:boolean;
  catalogLike:boolean;
  localReachable:boolean;
}

export interface ProspectScore {
  score:number;
  reasons:string[];
}

export interface DemoInput {
  businessName:string;
  area:string;
  category:ProspectCategory;
  color:ProspectColor;
}

export const prospectCategories:Record<ProspectCategory,string>={
  gastronomia:'Gastronomía',
  pizzeria:'Pizzería',
  rotiseria:'Rotisería',
  cafeteria:'Cafetería',
  panaderia:'Panadería',
  polleria:'Pollería',
  verduleria:'Verdulería',
  libreria:'Librería',
  grafica:'Gráfica / imprenta',
  'distribuidora-lacteos':'Distribuidora de lácteos',
  'molino-mayorista':'Molino / insumos',
  almacen:'Almacén',
  dietetica:'Dietética',
  petshop:'Pet shop',
};

const weights:Array<[keyof ProspectSignals,number,string]>=[
  ['runningAds',25,'Ya invierte en publicidad'],
  ['weakOrNoStore',20,'No tiene una tienda propia fuerte'],
  ['dmCheckout',20,'La compra termina en DM o WhatsApp'],
  ['strongVisuals',15,'Tiene material visual aprovechable'],
  ['catalogLike',10,'Su oferta funciona bien como catálogo'],
  ['localReachable',10,'Es local o comercialmente alcanzable'],
];

export function scoreProspect(signals:ProspectSignals):ProspectScore {
  return weights.reduce<ProspectScore>((result,[key,points,label])=>{
    if(signals[key]){
      result.score+=points;
      result.reasons.push(`+${points} ${label}`);
    }
    return result;
  },{score:0,reasons:[]});
}

const tmmBase=()=>((import.meta.env.VITE_TMM_BASE_URL as string|undefined)?.trim()||'https://tmm.gatrivi.com').replace(/\/$/,'');

function demoSearch(input:DemoInput){
  const params=new URLSearchParams({
    negocio:input.businessName.trim(),
    barrio:input.area.trim()||'Zona Norte',
    rubro:input.category,
    color:input.color,
  });
  return `?${params.toString()}`;
}

export function buildDemoLinks(input:DemoInput){
  const search=demoSearch(input);
  const base=tmmBase();
  return {
    builderUrl:`${base}/demo/armar${search}`,
    customerUrl:`${base}/demo${search}`,
    ownerUrl:`${base}/demo/owner${search}`,
  };
}

export function buildOutreachMessages(businessName:string,customerUrl:string){
  const name=businessName.trim()||'tu negocio';
  return [
    `Hola. Vi ${name} y armé una muestra rápida de cómo podría verse con catálogo y pedidos directos:\n${customerUrl}\n\nEs una demo visual con productos de ejemplo. Si te sirve, la adapto a tus productos reales.`,
    `Buenas! Estuve viendo ${name} y armé una demo rápida para mostrarte una idea:\n${customerUrl}\n\nLa idea es que catálogo, consultas y pedidos queden mucho más simples desde un solo link.`,
    `Hola! Te armé esto tomando ${name} como ejemplo:\n${customerUrl}\n\nNo hace falta cambiar cómo venden hoy: sirve para ordenar productos y mandar a la gente directo al producto o pedido que busca. Si te interesa, te muestro cómo quedaría con su material real.`,
  ];
}

export function buildOutreachMessage(businessName:string,customerUrl:string){
  return buildOutreachMessages(businessName,customerUrl)[0];
}
