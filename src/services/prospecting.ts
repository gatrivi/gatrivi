export type ProspectPlatform='instagram'|'facebook'|'other';
export type ProspectCategory='gastronomia'|'pizzeria'|'rotiseria'|'cafeteria'|'panaderia'|'polleria'|'verduleria'|'carniceria'|'reposteria'|'libreria'|'grafica'|'distribuidora-lacteos'|'molino-mayorista'|'almacen'|'dietetica'|'petshop';
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
  carniceria:'Carnicería',
  reposteria:'Repostería',
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

const publicDemoRoute:Partial<Record<ProspectCategory,string>>={
  gastronomia:'/demo/pizzeria',
  pizzeria:'/demo/pizzeria',
  rotiseria:'/demo/pizzeria',
  polleria:'/demo/pizzeria',
  cafeteria:'/demo/panaderia',
  panaderia:'/demo/panaderia',
  verduleria:'/demo/verduleria',
  carniceria:'/demo/carniceria',
  reposteria:'/demo/mamabel',
  almacen:'/demo/aguacats',
  dietetica:'/demo/aguacats',
};

function demoSearch(input:DemoInput){
  const params=new URLSearchParams({
    negocio:input.businessName.trim(),
    barrio:input.area.trim()||'Zona Norte',
    rubro:input.category,
    color:input.color,
    origen:'crm',
  });
  return `?${params.toString()}`;
}

export function buildDemoLinks(input:DemoInput){
  const search=demoSearch(input);
  const base=tmmBase();
  const route=publicDemoRoute[input.category]??'/demos';
  const customerUrl=`${base}${route}${search}`;
  const ownerRoute=route.startsWith('/demo/')?`${route}/owner`:'/demos';
  return {
    builderUrl:`${base}/demos${search}`,
    customerUrl,
    ownerUrl:`${base}${ownerRoute}${search}`,
  };
}

export function buildOutreachMessage(businessName:string,customerUrl:string){
  const name=businessName.trim()||'tu negocio';
  return `Hola. Vi ${name} y armé una muestra rápida del tipo de tienda que podría funcionar para ustedes:\n${customerUrl}\n\nEs una demo visual con productos de ejemplo. Si te sirve, la adapto a tus productos reales.`;
}
