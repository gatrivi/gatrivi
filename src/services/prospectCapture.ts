import type {ProspectCategory,ProspectPlatform} from './prospecting';

export interface ProspectCapture {
  sourceUrl:string;
  title:string;
  text:string;
  company:string;
  platform:ProspectPlatform;
  area:string;
  category:ProspectCategory;
  inferred:string[];
}

const genericTitles=/^(instagram|facebook|facebook watch|instagram photos and videos)$/i;
const socialPathWords=new Set(['p','reel','reels','stories','explore','share','watch','groups']);

const categoryMatchers:Array<[ProspectCategory,RegExp]>=[
  ['pizzeria',/\b(pizza|pizzeria|pizzería|muzza|fugazz|napolitana)\b/i],
  ['panaderia',/\b(panader|factura|medialuna|masa madre|bakery)\b/i],
  ['cafeteria',/\b(cafe|café|cafeter|coffee|barista)\b/i],
  ['rotiseria',/\b(rotiser|comida preparada|vianda|empanada)\b/i],
  ['polleria',/\b(poller|pollo|granja)\b/i],
  ['verduleria',/\b(verduler|fruter|fruta|verdura)\b/i],
  ['libreria',/\b(librer|papeler|útiles|utiles|cuaderno)\b/i],
  ['grafica',/\b(imprenta|gráfica|grafica|carteler|sublim|estampad)\b/i],
  ['distribuidora-lacteos',/\b(lácteo|lacteo|queso|fiambre|distribuidora)\b/i],
  ['molino-mayorista',/\b(molino|harina|insumos|mayorista)\b/i],
  ['dietetica',/\b(dietética|dietetica|natural|semilla|fruto seco)\b/i],
  ['petshop',/\b(pet ?shop|mascota|perro|gato|veterin)\b/i],
  ['almacen',/\b(almacén|almacen|despensa|mercado)\b/i],
  ['gastronomia',/\b(restaurante|restaurant|comida|gastronom|delivery|menú|menu)\b/i],
];

const areas=['Olivos','Florida','Vicente López','Vicente Lopez','La Lucila','Munro','Villa Martelli','Martínez','Martinez','San Isidro','Acassuso','Beccar','Núñez','Nuñez','Saavedra','Belgrano','Palermo','CABA'];

function firstUrl(...values:string[]){
  for(const value of values){
    const match=value.match(/https?:\/\/[^\s<>"']+/i);
    if(match)return match[0].replace(/[),.;!?]+$/,'');
  }
  return '';
}

export function platformFromSource(url:string,text=''):ProspectPlatform{
  const haystack=`${url} ${text}`.toLowerCase();
  if(haystack.includes('instagram.com')||haystack.includes('instagram'))return 'instagram';
  if(haystack.includes('facebook.com')||haystack.includes('fb.com')||haystack.includes('facebook'))return 'facebook';
  return 'other';
}

function humanizeHandle(handle:string){
  return handle.replace(/^@/,'').replace(/[._-]+/g,' ').replace(/\b\w/g,char=>char.toUpperCase()).trim().slice(0,80);
}

function handleFromSource(sourceUrl:string,text:string){
  const textHandle=text.match(/@([a-z0-9._-]{2,60})/i)?.[1];
  if(textHandle)return textHandle;
  try{
    const url=new URL(sourceUrl);
    const first=url.pathname.split('/').filter(Boolean)[0]?.replace(/^@/,'')??'';
    if(first&&!socialPathWords.has(first.toLowerCase()))return first;
  }catch{/* malformed shared URLs are ignored */}
  return '';
}

function cleanTitle(title:string){
  return title
    .replace(/\s*[|·•-]\s*(Instagram|Facebook)( photos and videos)?\s*$/i,'')
    .replace(/\s+on\s+(Instagram|Facebook)\s*$/i,'')
    .replace(/^Instagram\s*[-:|]\s*/i,'')
    .replace(/^Facebook\s*[-:|]\s*/i,'')
    .replace(/\s+/g,' ')
    .trim()
    .slice(0,80);
}

function inferCategory(haystack:string):ProspectCategory{
  return categoryMatchers.find(([,matcher])=>matcher.test(haystack))?.[0]??'gastronomia';
}

function inferArea(haystack:string){
  return areas.find(area=>new RegExp(`\\b${area.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')}\\b`,'i').test(haystack))??'Olivos';
}

export function parseProspectCapture(params:URLSearchParams):ProspectCapture{
  const title=params.get('title')?.trim()||params.get('name')?.trim()||'';
  const text=params.get('text')?.trim()||'';
  const explicitSource=params.get('url')?.trim()||params.get('source')?.trim()||'';
  const sourceUrl=firstUrl(explicitSource,text,title)||explicitSource;
  const platform=platformFromSource(sourceUrl,`${title} ${text}`);
  const cleaned=cleanTitle(title);
  const handle=handleFromSource(sourceUrl,text);
  const company=cleaned&&!genericTitles.test(cleaned)?cleaned:humanizeHandle(handle);
  const haystack=`${title} ${text} ${sourceUrl} ${handle}`;
  const category=inferCategory(haystack);
  const area=inferArea(haystack);
  const inferred:string[]=[];
  if(company)inferred.push(`negocio: ${company}`);
  if(category!=='gastronomia')inferred.push(`rubro: ${category}`);
  if(area!=='Olivos'||/olivos/i.test(haystack))inferred.push(`zona: ${area}`);
  if(platform!=='other')inferred.push(`fuente: ${platform}`);
  return {sourceUrl,title,text,company,platform,area,category,inferred};
}
