import type {ProspectCategory,ProspectPlatform} from './prospecting';

export interface SharedProspectPayload {
  title?:string;
  text?:string;
  url?:string;
  source?:string;
}

export interface ProspectPrefill {
  company:string;
  socialHandle:string;
  platform:ProspectPlatform;
  category:ProspectCategory;
  sourceUrl:string;
}

const categoryRules:Array<[ProspectCategory,RegExp]>=[
  ['pizzeria',/\b(pizzer[ií]a|pizza|pizzas|muzza|muzzarella)\b/i],
  ['rotiseria',/\b(rotiser[ií]a|rotiseria|viandas?|comida preparada|comidas preparadas)\b/i],
  ['cafeteria',/\b(cafeter[ií]a|cafeteria|caf[eé]|coffee|barista)\b/i],
  ['panaderia',/\b(panader[ií]a|panaderia|panificados?|facturas?|medialunas?)\b/i],
  ['polleria',/\b(poller[ií]a|polleria|pollos?|supremas?)\b/i],
  ['verduleria',/\b(verduler[ií]a|verduleria|fruter[ií]a|fruteria|frutas?|verduras?)\b/i],
  ['libreria',/\b(librer[ií]a|libreria|libros?|papeler[ií]a|papeleria)\b/i],
  ['grafica',/\b(gr[aá]fica|grafica|imprenta|carteler[ií]a|carteleria|impresi[oó]n|impresion)\b/i],
  ['distribuidora-lacteos',/\b(l[aá]cteos?|lacteos?|quesos?|fiambres?|distribuidora)\b/i],
  ['molino-mayorista',/\b(molino|harinas?|insumos? panader|insumos? gastron[oó]m)\b/i],
  ['almacen',/\b(almac[eé]n|almacen|kiosco|despensa|autoservicio)\b/i],
  ['dietetica',/\b(diet[eé]tica|dietetica|alimentos naturales|frutos secos)\b/i],
  ['petshop',/\b(pet ?shop|mascotas?|alimento para perros|alimento para gatos|veterinaria)\b/i],
];

const reservedProfilePaths=new Set(['p','reel','reels','stories','explore','accounts','marketplace','watch','groups','events','share']);

function cleanHandle(value=''){
  const match=value.match(/@([a-z0-9._-]{2,50})/i);
  return match?`@${match[1]}`:'';
}

function handleFromUrl(rawUrl=''){
  try{
    const url=new URL(rawUrl);
    const first=url.pathname.split('/').filter(Boolean)[0]||'';
    if(!first||reservedProfilePaths.has(first.toLowerCase()))return '';
    if(/^(instagram\.com|www\.instagram\.com|facebook\.com|www\.facebook\.com|m\.facebook\.com)$/i.test(url.hostname))return `@${first.replace(/^@/,'')}`;
  }catch{/* shared URLs can be partial; leave blank */}
  return '';
}

function platformFromUrl(rawUrl=''):ProspectPlatform{
  try{
    const host=new URL(rawUrl).hostname.toLowerCase();
    if(host.includes('instagram.com'))return 'instagram';
    if(host.includes('facebook.com')||host==='fb.com'||host.endsWith('.fb.com'))return 'facebook';
  }catch{/* manual share text may not contain a valid URL */}
  return 'other';
}

function prettifyHandle(handle:string){
  return handle.replace(/^@/,'').replace(/[._-]+/g,' ').replace(/\b\w/g,char=>char.toUpperCase()).trim();
}

function cleanTitle(title=''){
  return title
    .replace(/\s*[|•·]\s*(Instagram|Facebook).*$/i,'')
    .replace(/\s*[-–—]\s*(Instagram|Facebook).*$/i,'')
    .replace(/\s*\(@[a-z0-9._-]+\).*$/i,'')
    .replace(/\s+/g,' ')
    .trim();
}

function companyFromText(text=''){
  return text
    .split(/\r?\n/)
    .map(line=>line.trim())
    .find(line=>line.length>1&&!/^https?:\/\//i.test(line)&&!line.startsWith('@'))
    ?.replace(/\s+/g,' ')
    .slice(0,60)??'';
}

export function inferProspectPrefill(payload:SharedProspectPayload):ProspectPrefill{
  const sourceUrl=(payload.url||payload.source||'').trim();
  const combined=[payload.title,payload.text,sourceUrl].filter(Boolean).join(' ');
  const socialHandle=cleanHandle(combined)||handleFromUrl(sourceUrl);
  const titleCompany=cleanTitle(payload.title);
  const textCompany=companyFromText(payload.text);
  const company=(titleCompany||textCompany||prettifyHandle(socialHandle)).slice(0,60);
  const category=categoryRules.find(([,rule])=>rule.test(combined))?.[0]??'gastronomia';
  return {company,socialHandle,platform:platformFromUrl(sourceUrl),category,sourceUrl};
}

export function sharedPayloadFromSearch(search:URLSearchParams):SharedProspectPayload{
  return {
    title:search.get('title')??'',
    text:search.get('text')??'',
    url:search.get('url')??'',
    source:search.get('source')??'',
  };
}
