import {useMemo,useState,type FormEvent} from 'react';
import {CheckCircle2,Copy,ExternalLink,Link2,MessageCircle,Share2,Target} from 'lucide-react';
import {useSearchParams} from 'react-router-dom';
import {useCrm} from './context/CrmContext';
import {
  buildDemoLinks,
  buildOutreachMessage,
  prospectCategories,
  scoreProspect,
  type ProspectCategory,
  type ProspectColor,
  type ProspectPlatform,
  type ProspectSignals,
} from './services/prospecting';
import {inferProspectPrefill,sharedPayloadFromSearch} from './services/shareCapture';
import {outboundStageNames,stageIdByName,type OutboundStageName} from './services/outboundFunnel';

const defaultSignals:ProspectSignals={
  runningAds:true,
  weakOrNoStore:false,
  dmCheckout:false,
  strongVisuals:false,
  catalogLike:false,
  localReachable:true,
};

const signalLabels:Record<keyof ProspectSignals,string>={
  runningAds:'Está pautando anuncios',
  weakOrNoStore:'No tiene tienda propia fuerte',
  dmCheckout:'La compra termina por DM / WhatsApp',
  strongVisuals:'Tiene buenas fotos de producto',
  catalogLike:'Vende varios productos tipo catálogo',
  localReachable:'Es local / fácil de contactar',
};

const inputStyle={width:'100%',minHeight:46,border:'1px solid #3a3d46',borderRadius:10,padding:'0 13px',background:'#17191f',color:'inherit',fontSize:14} as const;
const labelStyle={display:'grid',gap:6,fontSize:12,fontWeight:700} as const;
const gridStyle={display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(220px,1fr))',gap:12} as const;
const primarySignalKeys:Array<keyof ProspectSignals>=['runningAds','dmCheckout','weakOrNoStore'];
const advancedSignalKeys:Array<keyof ProspectSignals>=['strongVisuals','catalogLike','localReachable'];

const nextStage:Partial<Record<OutboundStageName,OutboundStageName>>={
  'Encontrado':'Calificado',
  'Calificado':'Demo lista',
  'Demo lista':'DM enviado',
  'DM enviado':'Respondió',
  'Respondió':'Llamada',
  'Llamada':'Ganado',
};

const actionLabel:Partial<Record<OutboundStageName,string>>={
  'Encontrado':'Marcar calificado',
  'Calificado':'Marcar demo lista',
  'Demo lista':'Ya envié el DM',
  'DM enviado':'Respondió',
  'Respondió':'Pasar a llamada',
  'Llamada':'Cerrar ganado',
};

const instruction:Record<OutboundStageName,string>={
  'Encontrado':'Revisá las tres señales básicas. Si encaja, marcá el lead como calificado.',
  'Calificado':'Abrí la demo, revisá que se vea presentable y marcala como lista.',
  'Demo lista':'Abrí la demo, copiá el mensaje, abrí la fuente y mandalo. Después marcá “Ya envié el DM”.',
  'DM enviado':'No hace falta tocar este lead hasta que responda. Seguí capturando negocios nuevos.',
  'Respondió':'Contestá la conversación y buscá llevarla a una llamada corta.',
  'Llamada':'Hacé la llamada, resolvé objeciones y cerrá Ganado o Perdido.',
  'Ganado':'Venta cerrada. Pasá a entrega y cobro.',
  'Perdido':'No requiere acción. Podés revisarlo más adelante si cambia el contexto.',
};

export default function Prospects(){
  const {contacts,deals,stages,addProspect,moveDeal,tenant}=useCrm();
  const [params]=useSearchParams();
  const initial=inferProspectPrefill(sharedPayloadFromSearch(params));
  const shared=params.get('shared')==='1'||Boolean(params.get('source')||params.get('url'));
  const [started,setStarted]=useState(shared);
  const [leadUrl,setLeadUrl]=useState(initial.sourceUrl);
  const [company,setCompany]=useState(initial.company);
  const [socialHandle,setSocialHandle]=useState(initial.socialHandle);
  const [contactName,setContactName]=useState('');
  const [phone,setPhone]=useState('');
  const [sourceUrl,setSourceUrl]=useState(initial.sourceUrl);
  const [platform,setPlatform]=useState<ProspectPlatform>(initial.platform==='other'?'instagram':initial.platform);
  const [area,setArea]=useState('Olivos');
  const [category,setCategory]=useState<ProspectCategory>(initial.category);
  const [color,setColor]=useState<ProspectColor>('carbon');
  const [value,setValue]=useState('325000');
  const [signals,setSignals]=useState<ProspectSignals>(defaultSignals);
  const [saved,setSaved]=useState('');
  const [copied,setCopied]=useState('');

  const qualification=useMemo(()=>scoreProspect(signals),[signals]);
  const demoLinks=useMemo(()=>buildDemoLinks({businessName:company||'Tu negocio',area,category,color}),[company,area,category,color]);
  const outreach=useMemo(()=>buildOutreachMessage(company,demoLinks.customerUrl),[company,demoLinks.customerUrl]);
  const prospects=contacts.filter(contact=>contact.prospect).sort((a,b)=>(b.prospect?.createdAt??b.createdAt).localeCompare(a.prospect?.createdAt??a.createdAt));
  const crmCaptureUrl=typeof window==='undefined'?'':`${window.location.origin}/t/${tenant}/prospects`;
  const bookmarklet=`javascript:(()=>{const u=new URL(${JSON.stringify(crmCaptureUrl)});u.searchParams.set('source',location.href);u.searchParams.set('title',document.title);location.href=u.toString()})()`;
  const today=new Date().toISOString().slice(0,10);
  const capturedToday=prospects.filter(contact=>contact.createdAt.slice(0,10)===today).length;
  const dailyGoal=5;

  const dealForContact=(contactId:string)=>deals.find(deal=>deal.contactId===contactId);
  const stageForContact=(contactId:string)=>{
    const deal=dealForContact(contactId);
    return stages.find(stage=>stage.id===deal?.stageId)?.name as OutboundStageName|undefined;
  };
  const countAt=(name:OutboundStageName)=>deals.filter(deal=>stages.find(stage=>stage.id===deal.stageId)?.name===name).length;

  const focusProspect=prospects.find(contact=>stageForContact(contact.id)==='Demo lista')
    ??prospects.find(contact=>stageForContact(contact.id)==='Respondió')
    ??prospects.find(contact=>stageForContact(contact.id)==='Llamada')
    ??prospects.find(contact=>stageForContact(contact.id)==='Calificado')
    ??prospects.find(contact=>stageForContact(contact.id)==='Encontrado')
    ??prospects.find(contact=>stageForContact(contact.id)==='DM enviado');
  const focusStage=focusProspect?(stageForContact(focusProspect.id)??'Encontrado'):undefined;
  const focusMeta=focusProspect?.prospect;

  const setSignal=(key:keyof ProspectSignals)=>setSignals(current=>({...current,[key]:!current[key]}));
  const copy=async(key:string,text:string)=>{
    try{
      await navigator.clipboard.writeText(text);
      setCopied(key);
      window.setTimeout(()=>setCopied(current=>current===key?'':current),1500);
    }catch{setCopied('')}
  };

  const advance=(contactId:string,currentStage?:OutboundStageName)=>{
    if(!currentStage)return;
    const next=nextStage[currentStage];
    const deal=dealForContact(contactId);
    const target=next?stageIdByName(stages,next):undefined;
    if(deal&&target)moveDeal(deal.id,target);
  };

  const scrollToCapture=()=>window.setTimeout(()=>document.getElementById('capture-lead')?.scrollIntoView({behavior:'smooth',block:'start'}),0);

  const beginWithUrl=(event:FormEvent)=>{
    event.preventDefault();
    const raw=leadUrl.trim();
    if(raw){
      const inferred=inferProspectPrefill({source:raw});
      setSourceUrl(raw);
      if(inferred.company)setCompany(inferred.company);
      if(inferred.socialHandle)setSocialHandle(inferred.socialHandle);
      if(inferred.platform!=='other')setPlatform(inferred.platform);
      setCategory(inferred.category);
    }
    setStarted(true);
    scrollToCapture();
  };

  const beginManual=()=>{
    setStarted(true);
    scrollToCapture();
  };

  const submit=(event:FormEvent)=>{
    event.preventDefault();
    if(company.trim().length<2)return;
    addProspect({
      name:contactName||company,
      company,
      phone,
      email:'',
      value:Number(value)||0,
      prospect:{
        sourceUrl:sourceUrl.trim(),
        platform,
        socialHandle:socialHandle.trim(),
        area:area.trim()||'Zona Norte',
        category,
        color,
        score:qualification.score,
        scoreReasons:qualification.reasons,
        signals,
        builderUrl:demoLinks.builderUrl,
        demoUrl:demoLinks.customerUrl,
        ownerUrl:demoLinks.ownerUrl,
        outreachMessage:outreach,
      },
    });
    setSaved(company.trim());
    setLeadUrl('');setCompany('');setSocialHandle('');setContactName('');setPhone('');setSourceUrl('');
    setSignals(defaultSignals);
    setStarted(false);
    window.scrollTo({top:0,behavior:'smooth'});
  };

  const fit=qualification.score>=80?'Prioridad alta':qualification.score>=55?'Buen candidato':'Todavía no califica';

  return <div style={{display:'grid',gap:18}}>
    {!prospects.length?<section className="panel" style={{minHeight:0,border:'1px solid #5550e8',padding:'clamp(22px,4vw,42px)'}}>
      <span className="eyebrow">EMPEZÁ ACÁ · PASO 1 DE 3</span>
      <h2 style={{fontSize:'clamp(24px,4vw,38px)',margin:'8px 0 10px',maxWidth:760}}>Pegá el link de un negocio que venda por Instagram o Facebook.</h2>
      <p style={{maxWidth:720,color:'#aeb3c0',lineHeight:1.55}}>Tu trabajo es sólo elegir el negocio. El CRM arma la demo, prepara el mensaje y te dice qué hacer después.</p>
      <form onSubmit={beginWithUrl} style={{display:'flex',gap:10,marginTop:22,maxWidth:820,flexWrap:'wrap'}}>
        <input style={{...inputStyle,flex:'1 1 360px',minHeight:52}} value={leadUrl} onChange={event=>setLeadUrl(event.target.value)} placeholder="Pegá acá el perfil o anuncio: https://instagram.com/..." inputMode="url"/>
        <button className="primary" type="submit" style={{minHeight:52,paddingInline:20}}><Link2 size={17}/> Usar este negocio</button>
      </form>
      <button className="ghost" type="button" onClick={beginManual} style={{marginTop:10}}>No tengo el link · cargar a mano</button>

      <div style={{...gridStyle,marginTop:26}}>
        <div className="note"><b>✓ Buena señal #1</b><p>Está pagando anuncios o publica activamente.</p></div>
        <div className="note"><b>✓ Buena señal #2</b><p>La compra termina por DM o WhatsApp.</p></div>
        <div className="note"><b>✓ Buena señal #3</b><p>No tiene una tienda propia claramente mejor.</p></div>
      </div>
    </section>:<section className="panel" style={{minHeight:0,border:'1px solid #5550e8'}}>
      <span className="eyebrow">QUÉ HACER AHORA</span>
      {focusProspect&&focusStage&&focusMeta?<>
        <h2 style={{fontSize:26,margin:'8px 0 6px'}}>{focusProspect.company||focusProspect.name} · {focusStage}</h2>
        <p style={{maxWidth:780,color:'#aeb3c0',lineHeight:1.5}}>{instruction[focusStage]}</p>
        <div style={{display:'flex',gap:9,flexWrap:'wrap',marginTop:18}}>
          {focusStage==='Demo lista'&&<>
            <a className="primary" href={focusMeta.demoUrl} target="_blank" rel="noreferrer"><ExternalLink size={15}/> 1. Abrir demo</a>
            <button className="secondary" type="button" onClick={()=>copy(`focus-${focusProspect.id}`,focusMeta.outreachMessage)}><Copy size={15}/> {copied===`focus-${focusProspect.id}`?'Copiado':'2. Copiar DM'}</button>
            {focusMeta.sourceUrl&&<a className="secondary" href={focusMeta.sourceUrl} target="_blank" rel="noreferrer"><MessageCircle size={15}/> 3. Abrir negocio</a>}
            <button className="secondary" type="button" onClick={()=>advance(focusProspect.id,focusStage)}><CheckCircle2 size={15}/> 4. Ya lo envié</button>
          </>}
          {focusStage!=='Demo lista'&&nextStage[focusStage]&&<button className="primary" type="button" onClick={()=>advance(focusProspect.id,focusStage)}><CheckCircle2 size={15}/>{actionLabel[focusStage]}</button>}
          <button className="secondary" type="button" onClick={()=>{setStarted(true);scrollToCapture()}}><Target size={15}/> Capturar otro lead</button>
        </div>
      </>:<>
        <h2 style={{fontSize:26,margin:'8px 0 6px'}}>Capturá el próximo negocio</h2>
        <p style={{color:'#aeb3c0'}}>No hay ninguna acción pendiente en este momento.</p>
        <button className="primary" type="button" onClick={()=>{setStarted(true);scrollToCapture()}} style={{marginTop:16}}><Target size={15}/> Nuevo lead</button>
      </>}
    </section>}

    {shared&&<section className="panel" style={{minHeight:0,border:'1px solid #b7d733'}}>
      <div style={{display:'flex',gap:12,alignItems:'center'}}><Share2 size={20}/><div><b>Recibí el negocio que compartiste.</b><small style={{display:'block'}}>Revisá los datos mínimos de abajo y tocá “Guardar y crear demo”.</small></div></div>
    </section>}

    {started&&<section id="capture-lead" className="panel" style={{minHeight:0,scrollMarginTop:16,border:'1px solid #40434e'}}>
      <div className="panel-title">
        <div><span className="eyebrow">PASO 2 DE 3</span><h2>Confirmá que sea un buen lead</h2></div>
        <div style={{textAlign:'right'}}><strong style={{fontSize:28}}>{qualification.score}/100</strong><small style={{display:'block'}}>{fit}</small></div>
      </div>

      <form onSubmit={submit} style={{display:'grid',gap:18}}>
        <div style={gridStyle}>
          <label style={labelStyle}>Link del negocio<input style={inputStyle} type="url" value={sourceUrl} onChange={event=>setSourceUrl(event.target.value)} placeholder="https://instagram.com/..."/></label>
          <label style={labelStyle}>Nombre del negocio<input style={inputStyle} autoFocus value={company} onChange={event=>setCompany(event.target.value)} placeholder="Ej. Panadería Roma" required/></label>
          <label style={labelStyle}>Rubro<select style={inputStyle} value={category} onChange={event=>setCategory(event.target.value as ProspectCategory)}>{Object.entries(prospectCategories).map(([key,label])=><option key={key} value={key}>{label}</option>)}</select></label>
          <label style={labelStyle}>Zona<input style={inputStyle} value={area} onChange={event=>setArea(event.target.value)} placeholder="Olivos"/></label>
        </div>

        <div>
          <b style={{fontSize:14}}>Tocá lo que sea verdad:</b>
          <div style={{...gridStyle,marginTop:10}}>{primarySignalKeys.map(key=><button key={key} className={signals[key]?'primary':'secondary'} type="button" onClick={()=>setSignal(key)} style={{justifyContent:'flex-start',minHeight:48}}>{signals[key]?'✓':'○'} {signalLabels[key]}</button>)}</div>
        </div>

        <div className="note" style={{display:'grid',gap:8}}>
          <b>{qualification.score>=55?'✓ Listo: voy a crear la demo y ponerlo en “Demo lista”.':'Marcá al menos las señales que realmente cumple.'}</b>
          {company&&<span style={{fontSize:13,overflowWrap:'anywhere'}}>{demoLinks.customerUrl}</span>}
        </div>

        <details style={{border:'1px solid #343741',borderRadius:10,padding:14}}>
          <summary style={{cursor:'pointer',fontWeight:700,fontSize:13}}>Opcional · ajustar detalles</summary>
          <div style={{...gridStyle,marginTop:14}}>
            <label style={labelStyle}>Usuario / handle<input style={inputStyle} value={socialHandle} onChange={event=>setSocialHandle(event.target.value)} placeholder="@panaderiaroma"/></label>
            <label style={labelStyle}>Contacto<input style={inputStyle} value={contactName} onChange={event=>setContactName(event.target.value)} placeholder="Opcional"/></label>
            <label style={labelStyle}>Teléfono / WhatsApp<input style={inputStyle} value={phone} onChange={event=>setPhone(event.target.value)} placeholder="Opcional"/></label>
            <label style={labelStyle}>Plataforma<select style={inputStyle} value={platform} onChange={event=>setPlatform(event.target.value as ProspectPlatform)}><option value="instagram">Instagram</option><option value="facebook">Facebook</option><option value="other">Otra</option></select></label>
            <label style={labelStyle}>Color demo<select style={inputStyle} value={color} onChange={event=>setColor(event.target.value as ProspectColor)}><option value="carbon">Carbón</option><option value="coral">Coral</option><option value="verde">Verde</option><option value="azul">Azul</option><option value="violeta">Violeta</option></select></label>
            <label style={labelStyle}>Valor oportunidad<input style={inputStyle} type="number" min="0" step="1000" value={value} onChange={event=>setValue(event.target.value)}/></label>
          </div>
          <div style={{...gridStyle,marginTop:14}}>{advancedSignalKeys.map(key=><button key={key} className={signals[key]?'primary':'secondary'} type="button" onClick={()=>setSignal(key)} style={{justifyContent:'flex-start'}}>{signals[key]?'✓':'○'} {signalLabels[key]}</button>)}</div>
        </details>

        <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',gap:12,flexWrap:'wrap'}}>
          <small>{saved?`${saved} ya está en el funnel.`:'Después de guardar, arriba te voy a decir exactamente qué mandar y dónde.'}</small>
          <button className="primary" type="submit" style={{minHeight:50,paddingInline:20}}><Target size={16}/> Guardar y crear demo</button>
        </div>
      </form>
    </section>}

    {prospects.length>0&&<section className="panel" style={{minHeight:0}}>
      <div className="panel-title"><div><span className="eyebrow">TU FUNNEL</span><h2>Estado de ventas</h2></div><b>{capturedToday}/{dailyGoal} leads hoy</b></div>
      <div style={{display:'grid',gridTemplateColumns:'repeat(8,minmax(105px,1fr))',gap:8,overflowX:'auto',paddingBottom:6}}>
        {outboundStageNames.map(name=>{
          const stage=stages.find(item=>item.name===name);
          return <div key={name} style={{border:'1px solid #343741',borderRadius:10,padding:12,minWidth:105}}>
            <span className="dot" style={{background:stage?.color}}/> <small>{name}</small>
            <strong style={{display:'block',fontSize:22,marginTop:8}}>{countAt(name)}</strong>
          </div>;
        })}
      </div>

      <div style={{marginTop:18}}>{prospects.map(contact=>{
        const prospect=contact.prospect!;
        const currentStage=stageForContact(contact.id)??'Encontrado';
        return <div className="stage-row" key={contact.id} style={{display:'grid',gridTemplateColumns:'minmax(170px,1.2fr) 90px 1fr auto',gap:12}}>
          <span><b>{contact.company||contact.name}</b><small style={{display:'block'}}>{prospect.socialHandle?`${prospect.socialHandle} · `:''}{prospect.area}</small></span>
          <span><b>{prospect.score}/100</b><small style={{display:'block'}}>{currentStage}</small></span>
          <small>{instruction[currentStage]}</small>
          <span style={{display:'flex',gap:6,flexWrap:'wrap',justifyContent:'flex-end'}}>
            <a className="link" href={prospect.demoUrl} target="_blank" rel="noreferrer">Demo ↗</a>
            <button className="link" type="button" onClick={()=>copy(contact.id,prospect.outreachMessage)}>{copied===contact.id?'Copiado':'Copiar DM'}</button>
          </span>
        </div>;
      })}</div>
    </section>}

    <details className="panel" style={{minHeight:0}}>
      <summary style={{cursor:'pointer',fontWeight:700}}>Captura rápida desde teléfono / navegador</summary>
      <div style={{...gridStyle,marginTop:16}}>
        <div className="note"><b>📱 Teléfono</b><p>Instalá Gatrivi CRM. Desde una publicación o perfil: Compartir → Gatrivi CRM.</p></div>
        <div className="note"><b>🔖 Desktop</b><p>Guardá un favorito “TMM lead” con este bookmarklet.</p><button className="secondary" type="button" onClick={()=>copy('bookmarklet',bookmarklet)}><Copy size={15}/> {copied==='bookmarklet'?'Copiado':'Copiar bookmarklet'}</button></div>
      </div>
    </details>
  </div>;
}
