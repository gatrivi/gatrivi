import {Navigate,NavLink,Route,Routes,useNavigate,useParams,useSearchParams} from 'react-router-dom';
import {BarChart3,BriefcaseBusiness,CheckSquare,ContactRound,Edit3,LogOut,Plus,Search,Target,X} from 'lucide-react';
import {CrmProvider,useCrm} from './context/CrmContext';
import {authenticate,getSession,signOut,startSession} from './services/auth';
import {registerCrmPwa} from './services/pwa';
import Prospects from './Prospects';
import ShareTarget from './ShareTarget';
import type {ContactLocation} from './types';
import {useEffect,useState,type DragEvent,type FormEvent,type ReactNode} from 'react';

const money=(n:number)=>new Intl.NumberFormat('es-AR',{style:'currency',currency:'ARS',maximumFractionDigits:0}).format(n);
const todayLabel=()=>new Intl.DateTimeFormat('es-AR',{weekday:'long',day:'numeric',month:'long'}).format(new Date()).toUpperCase();
const dateInputValue=(date:Date)=>{const offset=date.getTimezoneOffset()*60000;return new Date(date.getTime()-offset).toISOString().slice(0,10)};
const today=()=>dateInputValue(new Date());
const tomorrow=()=>dateInputValue(new Date(Date.now()+86400000));

function Empty({children}:{children:ReactNode}){return <div className="empty">{children}</div>}

function Shell({children}:{children:ReactNode}){
  const {tenant,persistenceError}=useCrm();
  const navigate=useNavigate();
  const session=getSession();
  const nav=[['dashboard','Resumen',BarChart3],['pipeline','Pipeline',BriefcaseBusiness],['prospects','Prospectos',Target],['contacts','Contactos',ContactRound],['tasks','Tareas',CheckSquare]] as const;
  const name=session?.name??'Vos';
  const initials=name.split(' ').map(part=>part[0]).join('').slice(0,2).toUpperCase();
  return <div className="app">
    <aside>
      <div className="brand"><span>✦</span> GATRIVI CRM</div>
      <p className="tenant">ESPACIO DE TRABAJO<br/><b>{tenant}</b></p>
      <nav>{nav.map(([to,label,Icon])=><NavLink key={to} to={`/t/${tenant}/${to}`} className={({isActive})=>isActive?'active':''}><Icon size={18}/>{label}</NavLink>)}</nav>
      <div className="aside-bottom">
        <div className="avatar">{initials}</div>
        <div><b>{name}</b><small>Equipo comercial</small></div>
        <button className="logout-button" type="button" title="Cerrar sesión" onClick={()=>{signOut();navigate('/login',{replace:true})}}><LogOut size={17}/></button>
      </div>
    </aside>
    <main>
      <header>
        <div><span className="eyebrow">{todayLabel()}</span><h1>Buen día, {name}</h1></div>
        <button className="primary" onClick={()=>navigate(`/t/${tenant}/pipeline?new=1`)}><Plus size={17}/> Nuevo negocio</button>
      </header>
      {persistenceError&&<div className="warning">{persistenceError}</div>}
      {children}
    </main>
  </div>
}

function Dashboard(){
  const {contacts,deals,tasks,stages,tenant}=useCrm();
  return <>
    <div className="stats">
      <Stat label="Negocios activos" value={String(deals.filter(deal=>stages.find(stage=>stage.id===deal.stageId)?.name!=='Perdido').length)} note="en tu pipeline"/>
      <Stat label="Valor del pipeline" value={money(deals.reduce((total,deal)=>total+deal.value,0))} note="valor total"/>
      <Stat label="Contactos" value={String(contacts.length)} note="en tu agenda"/>
      <Stat label="Tareas pendientes" value={String(tasks.filter(task=>!task.done).length)} note="para seguir"/>
    </div>
    <div className="grid-2">
      <section className="panel">
        <div className="panel-title"><div><span className="eyebrow">OPORTUNIDADES</span><h2>Tu pipeline</h2></div><NavLink to={`/t/${tenant}/pipeline`} className="link">Ver todo →</NavLink></div>
        {stages.length?stages.slice(0,4).map(stage=><div className="stage-row" key={stage.id}><span className="dot" style={{background:stage.color}}/><span>{stage.name}</span><b>{deals.filter(deal=>deal.stageId===stage.id).length}</b><em>{money(deals.filter(deal=>deal.stageId===stage.id).reduce((total,deal)=>total+deal.value,0))}</em></div>):<Empty>Sin etapas todavía.</Empty>}
      </section>
      <section className="panel">
        <div className="panel-title"><div><span className="eyebrow">PRÓXIMOS PASOS</span><h2>Tus tareas</h2></div><NavLink to={`/t/${tenant}/tasks`} className="link">Ver todo →</NavLink></div>
        <TaskRows limit={4}/>
      </section>
    </div>
  </>
}

function Stat({label,value,note}:{label:string;value:string;note:string}){return <div className="stat"><span>{label}</span><strong>{value}</strong><small>{note}</small></div>}

function TaskRows({limit}:{limit:number}){
  const {tasks,toggleTask}=useCrm();
  const pending=tasks.filter(task=>!task.done).slice(0,limit);
  if(!pending.length)return <Empty>No tenés tareas pendientes.</Empty>;
  return <div>{pending.map(task=><label className="task" key={task.id}><input type="checkbox" checked={task.done} onChange={()=>toggleTask(task.id)}/><span>{task.title}</span><small>{task.dueDate}</small></label>)}</div>;
}

function Pipeline(){
  const {deals,stages,contacts,moveDeal,updateStage}=useCrm();
  const [params,setParams]=useSearchParams();
  const [dragged,setDragged]=useState('');
  const [editingStageId,setEditingStageId]=useState('');
  const [draftName,setDraftName]=useState('');
  const [hoverStageId,setHoverStageId]=useState('');
  const modalOpen=params.get('new')==='1';

  useEffect(()=>{if(editingStageId)setDraftName(stages.find(stage=>stage.id===editingStageId)?.name??'')},[editingStageId,stages]);
  const openModal=()=>{const next=new URLSearchParams(params);next.set('new','1');setParams(next)};
  const closeModal=()=>{const next=new URLSearchParams(params);next.delete('new');setParams(next,{replace:true})};
  const startDrag=(event:DragEvent<HTMLElement>,dealId:string)=>{setDragged(dealId);event.dataTransfer.effectAllowed='move';event.dataTransfer.setData('text/plain',dealId)};
  const dropToStage=(stageId:string)=>{if(dragged)moveDeal(dragged,stageId);setDragged('');setHoverStageId('')};
  const saveStage=()=>{if(editingStageId&&draftName.trim())updateStage(editingStageId,draftName.trim());setEditingStageId('')};

  return <>
    <section className="panel wide">
      <div className="panel-title"><div><span className="eyebrow">GESTIÓN COMERCIAL</span><h2>Pipeline de ventas</h2></div><button className="secondary" onClick={openModal}><Plus size={16}/> Agregar negocio</button></div>
      <div className="kanban">{stages.map(stage=>{
        const items=deals.filter(deal=>deal.stageId===stage.id);
        const editing=editingStageId===stage.id;
        return <div className={`column ${hoverStageId===stage.id?'drop-active':''}`} key={stage.id} onDragOver={event=>{event.preventDefault();setHoverStageId(stage.id)}} onDragLeave={()=>setHoverStageId(current=>current===stage.id?'':current)} onDrop={event=>{event.preventDefault();dropToStage(stage.id)}}>
          <div className="column-head"><span><i className="dot" style={{background:stage.color}}/> {editing?<input className="stage-input" value={draftName} onChange={event=>setDraftName(event.target.value)} onKeyDown={event=>{if(event.key==='Enter')saveStage();if(event.key==='Escape')setEditingStageId('')}} autoFocus/>:<>{stage.name}</>}</span><div className="stage-actions"><b>{items.length}</b><button className="icon-button" type="button" onClick={()=>editing?saveStage():setEditingStageId(stage.id)}>{editing?'Guardar':<Edit3 size={14}/>}</button></div></div>
          {items.map(deal=><article draggable onDragStart={event=>startDrag(event,deal.id)} onDragEnd={()=>setDragged('')} className={`deal ${dragged===deal.id?'dragging':''}`} key={deal.id}><b>{deal.title}</b><p>{contacts.find(contact=>contact.id===deal.contactId)?.name??'Sin contacto'}</p><strong>{money(deal.value)}</strong></article>)}
          <div className="drop">{hoverStageId===stage.id?'Soltar acá':items.length?'Arrastrar acá':'Sin negocios'}</div>
        </div>
      })}</div>
    </section>
    <QuickLeadModal open={modalOpen} onClose={closeModal}/>
  </>
}

function QuickLeadModal({open,onClose}:{open:boolean;onClose:()=>void}){
  const {addLead}=useCrm();
  const [name,setName]=useState('');
  const [company,setCompany]=useState('');
  const [phone,setPhone]=useState('');
  const [email,setEmail]=useState('');
  const [dealTitle,setDealTitle]=useState('');
  const [value,setValue]=useState('');
  const [location,setLocation]=useState<ContactLocation|undefined>();
  const [addressMode,setAddressMode]=useState(false);
  const [locationStatus,setLocationStatus]=useState('');
  if(!open)return null;
  const useGps=()=>{
    if(!navigator.geolocation){setLocationStatus('Este dispositivo no ofrece ubicación.');return}
    setLocationStatus('Buscando ubicación…');
    navigator.geolocation.getCurrentPosition(
      ({coords})=>{
        setLocation({lat:Number(coords.latitude.toFixed(6)),lng:Number(coords.longitude.toFixed(6))});
        setAddressMode(false);
        setLocationStatus('GPS guardado ✓');
      },
      error=>setLocationStatus(error.code===1?'Permiso de ubicación denegado.':'No pude obtener la ubicación.'),
      {enableHighAccuracy:true,timeout:10000,maximumAge:60000},
    );
  };
  const useAddress=()=>{
    setAddressMode(true);
    setLocation(current=>current?.address?current:undefined);
    setLocationStatus('');
  };
  const submit=(event:FormEvent)=>{
    event.preventDefault();
    const trimmedCompany=company.trim();
    const trimmedName=name.trim();
    const leadName=trimmedName||trimmedCompany;
    const leadTitle=dealTitle.trim()||trimmedCompany||trimmedName;
    if(!leadName||!leadTitle)return;
    const savedLocation=location?.address?.trim()?{address:location.address.trim()}:location?.lat!=null&&location.lng!=null?location:undefined;
    addLead({name:leadName,company:trimmedCompany,phone:phone.trim(),email:email.trim(),dealTitle:leadTitle,value:Number(value)||0,location:savedLocation});
    setName('');setCompany('');setPhone('');setEmail('');setDealTitle('');setValue('');setLocation(undefined);setAddressMode(false);setLocationStatus('');
    onClose();
  };
  return <div className="modal-backdrop" onMouseDown={event=>{if(event.target===event.currentTarget)onClose()}}>
    <form className="modal" onSubmit={submit}>
      <div className="modal-head"><div><span className="eyebrow">ALTA RÁPIDA</span><h2>Nuevo negocio</h2></div><button className="icon-button" type="button" aria-label="Cerrar" onClick={onClose}><X size={16}/></button></div>
      <p className="modal-hint">Con nombre o empresa alcanza. Sumá WhatsApp y ubicación si los tenés.</p>
      <label>Nombre o empresa<input autoFocus autoComplete="organization" enterKeyHint="next" value={company} onChange={event=>setCompany(event.target.value)} placeholder="Ej. Panadería Roma" required/></label>
      <label>Teléfono / WhatsApp<input type="tel" inputMode="tel" autoComplete="tel" enterKeyHint="done" value={phone} onChange={event=>setPhone(event.target.value)} placeholder="11 2345 6789"/></label>
      <div style={{display:'flex',gap:8,flexWrap:'wrap',margin:'4px 0 8px'}}>
        <button className={location?.lat!=null?'secondary':'ghost'} type="button" onClick={useGps}>📍 Usar GPS</button>
        <button className={addressMode?'secondary':'ghost'} type="button" onClick={useAddress}>✏️ Dirección</button>
      </div>
      {addressMode&&<label>Dirección del local<input autoComplete="street-address" enterKeyHint="done" value={location?.address??''} onChange={event=>setLocation({address:event.target.value})} placeholder="Ej. Av. Maipú 1234, Olivos"/></label>}
      {(locationStatus||location?.address)&&<small style={{display:'block',margin:'-2px 0 8px',color:'#8f99aa'}}>{locationStatus||`Dirección: ${location?.address}`}</small>}
      <details className="form-details">
        <summary>Más datos · opcional</summary>
        <label>Persona de contacto<input autoComplete="name" value={name} onChange={event=>setName(event.target.value)} placeholder="Ej. Juan Pérez"/></label>
        <label>Email<input type="email" inputMode="email" autoComplete="email" value={email} onChange={event=>setEmail(event.target.value)} placeholder="nombre@empresa.com"/></label>
        <div className="form-grid"><label>Negocio / oportunidad<input value={dealTitle} onChange={event=>setDealTitle(event.target.value)} placeholder={company||'Ej. Venta web'}/></label><label>Valor estimado<input type="number" inputMode="numeric" min="0" step="1000" value={value} onChange={event=>setValue(event.target.value)} placeholder="0"/></label></div>
      </details>
      <div className="modal-actions"><button type="button" className="ghost" onClick={onClose}>Cancelar</button><button className="primary" type="submit"><Plus size={16}/> Guardar negocio</button></div>
    </form>
  </div>
}

function Contacts(){
  const {contacts,deals,tasks,tenant}=useCrm();
  const [q,setQ]=useState('');
  const filtered=contacts.filter(contact=>(contact.name+contact.company+contact.email+contact.phone+(contact.location?.address??'')).toLowerCase().includes(q.toLowerCase()));
  return <section className="panel wide">
    <div className="panel-title"><div><span className="eyebrow">AGENDA</span><h2>Contactos</h2></div><div className="search"><Search size={17}/><input inputMode="search" enterKeyHint="search" placeholder="Buscar contacto..." value={q} onChange={event=>setQ(event.target.value)}/></div></div>
    {!contacts.length?<Empty>Sin contactos. Cargá tu primer negocio desde el botón superior.</Empty>:!filtered.length?<Empty>No hay resultados para “{q}”.</Empty>:<div className="contact-list">{filtered.map(contact=><article className="contact" key={contact.id}><div className="avatar large">{contact.name.split(' ').map(part=>part[0]).join('').slice(0,2)}</div><div><b>{contact.name}</b><p>{contact.company||'Sin empresa'}{contact.email?` · ${contact.email}`:''}</p><small>{deals.filter(deal=>deal.contactId===contact.id).length} negocios · {tasks.filter(task=>task.contactId===contact.id&&!task.done).length} tareas pendientes</small></div><NavLink className="link" to={`/t/${tenant}/contacts/${contact.id}`}>Ver detalle →</NavLink></article>)}</div>}
  </section>
}

function ContactDetail(){
  const {id,tenant}=useParams();
  const {contacts,deals,tasks}=useCrm();
  const contact=contacts.find(item=>item.id===id);
  if(!contact)return <section className="panel"><Empty>Contacto no encontrado.</Empty></section>;
  const linkedDeals=deals.filter(deal=>deal.contactId===contact.id);
  const linkedTasks=tasks.filter(task=>task.contactId===contact.id);
  const mapHref=contact.location?.lat!=null&&contact.location.lng!=null
    ?`https://www.google.com/maps?q=${contact.location.lat},${contact.location.lng}`
    :contact.location?.address?`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(contact.location.address)}`:'';
  const locationLabel=contact.location?.address??(contact.location?.lat!=null&&contact.location.lng!=null?`${contact.location.lat}, ${contact.location.lng}`:'');
  return <section className="panel wide detail">
    <NavLink className="link" to={`/t/${tenant}/contacts`}>← Volver a contactos</NavLink>
    <div className="detail-head"><div className="avatar large">{contact.name.split(' ').map(part=>part[0]).join('').slice(0,2)}</div><div><span className="eyebrow">CONTACTO</span><h2>{contact.name}</h2><p>{contact.company||'Sin empresa'}{contact.email?` · ${contact.email}`:''}{contact.phone?` · ${contact.phone}`:''}</p></div></div>
    <p className="note">{contact.notes||'Sin notas.'}</p>
    {locationLabel&&<div className="stage-row"><span>📍 {locationLabel}</span>{mapHref&&<a className="link" href={mapHref} target="_blank" rel="noreferrer">Abrir en Maps ↗</a>}</div>}
    {contact.prospect&&<><h3>Prospecto TMM · {contact.prospect.score}/100</h3><div className="stage-row"><span>{contact.prospect.socialHandle?`${contact.prospect.socialHandle} · `:''}{contact.prospect.scoreReasons.join(' · ')}</span><a className="link" href={contact.prospect.demoUrl} target="_blank" rel="noreferrer">Abrir demo →</a></div></>}
    <h3>Negocios vinculados</h3>{linkedDeals.length?linkedDeals.map(deal=><div className="stage-row" key={deal.id}><span>{deal.title}</span><b>{money(deal.value)}</b></div>):<Empty>Sin negocios vinculados.</Empty>}
    <h3>Tareas vinculadas</h3>{linkedTasks.length?linkedTasks.map(task=><div className="stage-row" key={task.id}><span>{task.title}</span><b>{task.done?'Lista':'Pendiente'}</b></div>):<Empty>Sin tareas vinculadas.</Empty>}
  </section>
}

function Tasks(){
  const {tasks,toggleTask,contacts}=useCrm();
  const [filter,setFilter]=useState<'all'|'pending'|'done'>('pending');
  const [params,setParams]=useSearchParams();
  const adding=params.get('new')==='1';
  const setAdding=(open:boolean)=>{const next=new URLSearchParams(params);if(open)next.set('new','1');else next.delete('new');setParams(next,{replace:!open})};
  const visible=tasks.filter(task=>filter==='all'||filter==='done'&&task.done||filter==='pending'&&!task.done);
  return <>
    <section className="panel wide">
      <div className="panel-title"><div><span className="eyebrow">ORGANIZACIÓN</span><h2>Tareas</h2></div><div className="panel-actions"><div className="tabs">{(['pending','done','all'] as const).map(item=><button className={filter===item?'selected':''} onClick={()=>setFilter(item)} key={item}>{item==='pending'?'Pendientes':item==='done'?'Hechas':'Todas'}</button>)}</div><button className="secondary" onClick={()=>setAdding(true)}><Plus size={16}/> Nueva tarea</button></div></div>
      {visible.length?visible.map(task=><label className="task full" key={task.id}><input type="checkbox" checked={task.done} onChange={()=>toggleTask(task.id)}/><span className={task.done?'completed':''}>{task.title}</span><small>{task.contactId?contacts.find(contact=>contact.id===task.contactId)?.name+' · ':''}{task.dueDate}</small></label>):<Empty>No hay tareas en esta vista.</Empty>}
    </section>
    <TaskModal open={adding} onClose={()=>setAdding(false)}/>
  </>
}

function TaskModal({open,onClose}:{open:boolean;onClose:()=>void}){
  const {addTask,contacts}=useCrm();
  const [title,setTitle]=useState('');
  const [dueDate,setDueDate]=useState(tomorrow());
  const [contactId,setContactId]=useState('');
  if(!open)return null;
  const submit=(event:FormEvent)=>{
    event.preventDefault();
    if(!title.trim())return;
    addTask({title:title.trim(),dueDate,contactId:contactId||undefined});
    setTitle('');setDueDate(tomorrow());setContactId('');onClose();
  };
  return <div className="modal-backdrop" onMouseDown={event=>{if(event.target===event.currentTarget)onClose()}}>
    <form className="modal compact" onSubmit={submit}>
      <div className="modal-head"><div><span className="eyebrow">SEGUIMIENTO</span><h2>Nueva tarea</h2></div><button className="icon-button" type="button" aria-label="Cerrar" onClick={onClose}><X size={16}/></button></div>
      <label>Tarea<input autoFocus enterKeyHint="done" value={title} onChange={event=>setTitle(event.target.value)} placeholder="Ej. Escribir a Juan" required/></label>
      <div className="date-shortcuts"><button type="button" className={dueDate===today()?'secondary':'ghost'} onClick={()=>setDueDate(today())}>Hoy</button><button type="button" className={dueDate===tomorrow()?'secondary':'ghost'} onClick={()=>setDueDate(tomorrow())}>Mañana</button></div>
      <label>Fecha<input type="date" value={dueDate} onChange={event=>setDueDate(event.target.value)} required/></label>
      <label>Contacto<select value={contactId} onChange={event=>setContactId(event.target.value)}><option value="">Sin contacto</option>{contacts.map(contact=><option key={contact.id} value={contact.id}>{contact.name}</option>)}</select></label>
      <div className="modal-actions"><button type="button" className="ghost" onClick={onClose}>Cancelar</button><button className="primary" type="submit">Guardar tarea</button></div>
    </form>
  </div>
}

function Login(){
  const navigate=useNavigate();
  const [params]=useSearchParams();
  const [username,setUsername]=useState('gaston');
  const [password,setPassword]=useState('');
  const [error,setError]=useState('');
  const submit=async(event:FormEvent)=>{
    event.preventDefault();
    setError('');
    const user=await authenticate(username,password);
    if(!user){setError('Usuario o contraseña incorrectos.');return}
    startSession(user);
    const next=params.get('next');
    const safeNext=next?.startsWith('/')&&!next.startsWith('//')?next:null;
    navigate(safeNext??`/t/${user.tenant}/dashboard`,{replace:true});
  };
  return <div className="login"><form className="login-card" onSubmit={submit}>
    <div className="brand"><span>✦</span> GATRIVI CRM</div>
    <h1>Entrá a tu espacio</h1>
    <p>Contactos, negocios y próximos pasos sin vueltas.</p>
    <input className="login-input" autoComplete="username" placeholder="Usuario" value={username} onChange={event=>setUsername(event.target.value)}/>
    <input className="login-input" autoComplete="current-password" type="password" placeholder="Contraseña" value={password} onChange={event=>setPassword(event.target.value)}/>
    {error&&<p className="error">{error}</p>}
    <button className="primary full-button" type="submit">Entrar</button>
    <small className="login-help">Usuarios de prueba: gaston / fausto</small>
  </form></div>
}

function TenantApp(){
  const {slug='gatrivi'}=useParams();
  const session=getSession();
  if(!session)return <Navigate to="/login" replace/>;
  if(slug!==session.tenant)return <Navigate to={`/t/${session.tenant}/dashboard`} replace/>;
  return <CrmProvider tenant={session.tenant}><Shell><Routes><Route path="dashboard" element={<Dashboard/>}/><Route path="pipeline" element={<Pipeline/>}/><Route path="prospects" element={<Prospects/>}/><Route path="contacts" element={<Contacts/>}/><Route path="contacts/:id" element={<ContactDetail/>}/><Route path="tasks" element={<Tasks/>}/><Route path="*" element={<Navigate to="dashboard" replace/>}/></Routes></Shell></CrmProvider>
}

function HomeRedirect(){const session=getSession();return <Navigate to={session?`/t/${session.tenant}/dashboard`:'/login'} replace/>}

export default function App(){
  useEffect(()=>registerCrmPwa(),[]);
  return <Routes><Route path="/share-target" element={<ShareTarget/>}/><Route path="/login" element={<Login/>}/><Route path="/t/:slug/*" element={<TenantApp/>}/><Route path="*" element={<HomeRedirect/>}/></Routes>;
}
