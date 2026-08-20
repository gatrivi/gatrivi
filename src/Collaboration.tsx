import {useEffect,useMemo,useState,type FormEvent} from 'react';
import {Check,MessageCircle,UserPlus,Users,X} from 'lucide-react';
import {useCrm} from './context/CrmContext';
import {createUser,getSession,listWorkspaceUsers,type WorkspaceUser} from './services/auth';
import './collaboration.css';

const when=(value:string)=>new Intl.DateTimeFormat('es-AR',{day:'2-digit',month:'short',hour:'2-digit',minute:'2-digit'}).format(new Date(value));

export default function Collaboration(){
  const {tenant,tasks,messages,proposals,addMessage,addProposal,decideProposal}=useCrm();
  const session=getSession();
  const [members,setMembers]=useState<WorkspaceUser[]>([]);
  const [messageTo,setMessageTo]=useState('');
  const [message,setMessage]=useState('');
  const [proposalTo,setProposalTo]=useState('');
  const [proposalTitle,setProposalTitle]=useState('');
  const [proposalBody,setProposalBody]=useState('');
  const [proposalTaskId,setProposalTaskId]=useState('');
  const [showCreate,setShowCreate]=useState(false);
  const [createError,setCreateError]=useState('');
  const [createdNotice,setCreatedNotice]=useState('');

  const refreshMembers=()=>listWorkspaceUsers(tenant).then(setMembers);
  useEffect(()=>{refreshMembers()},[tenant]);

  const others=members.filter(member=>member.username!==session?.username);
  useEffect(()=>{
    if(!messageTo&&others[0])setMessageTo(others[0].username);
    if(!proposalTo&&others[0])setProposalTo(others[0].username);
  },[members,messageTo,proposalTo]);

  const visibleMessages=useMemo(()=>messages
    .filter(item=>item.fromUsername===session?.username||item.toUsername===session?.username||item.toUsername==='all')
    .sort((a,b)=>b.createdAt.localeCompare(a.createdAt)),[messages,session?.username]);
  const visibleProposals=useMemo(()=>proposals
    .filter(item=>item.createdBy===session?.username||item.recipientUsername===session?.username)
    .sort((a,b)=>b.createdAt.localeCompare(a.createdAt)),[proposals,session?.username]);

  const submitMessage=(event:FormEvent)=>{
    event.preventDefault();
    if(!message.trim()||!messageTo)return;
    addMessage({toUsername:messageTo,body:message});
    setMessage('');
  };
  const submitProposal=(event:FormEvent)=>{
    event.preventDefault();
    if(!proposalTo||!proposalTitle.trim()||!proposalBody.trim())return;
    addProposal({recipientUsername:proposalTo,title:proposalTitle,body:proposalBody,taskId:proposalTaskId||undefined});
    setProposalTitle('');setProposalBody('');setProposalTaskId('');
  };

  return <div className="collab-grid">
    <section className="panel">
      <div className="panel-title">
        <div><span className="eyebrow">PERSONAS</span><h2><Users size={20}/> Equipo</h2></div>
        {session?.username==='faus'&&<button className="secondary" onClick={()=>setShowCreate(current=>!current)}><UserPlus size={16}/> Usuario</button>}
      </div>
      <div className="member-list">{members.map(member=><div className="member-row" key={member.username}>
        <div className="avatar">{member.name.split(' ').map(part=>part[0]).join('').slice(0,2).toUpperCase()}</div>
        <div><b>{member.name}</b><small>@{member.username}{member.role==='admin'?' · admin':''}</small></div>
      </div>)}</div>
      {showCreate&&session?.username==='faus'&&<CreateUserForm tenant={tenant} onCreated={async user=>{setCreatedNotice(`${user.name} creado.`);setCreateError('');await refreshMembers()}} onError={setCreateError}/>} 
      {createError&&<p className="error">{createError}</p>}
      {createdNotice&&<p className="success-note">{createdNotice}</p>}
    </section>

    <section className="panel">
      <div className="panel-title"><div><span className="eyebrow">CHAT SIMPLE</span><h2><MessageCircle size={20}/> Mensajes</h2></div></div>
      <form className="stack-form" onSubmit={submitMessage}>
        <label>Para<select value={messageTo} onChange={event=>setMessageTo(event.target.value)}><option value="all">Todos</option>{others.map(member=><option key={member.username} value={member.username}>{member.name}</option>)}</select></label>
        <label>Mensaje<textarea rows={3} value={message} onChange={event=>setMessage(event.target.value)} placeholder="Escribí algo breve…" required/></label>
        <button className="primary" type="submit">Enviar</button>
      </form>
      <div className="feed">{visibleMessages.length?visibleMessages.map(item=><article className="feed-card" key={item.id}>
        <div><b>@{item.fromUsername}</b><span> → {item.toUsername==='all'?'todos':`@${item.toUsername}`}</span><small>{when(item.createdAt)}</small></div>
        <p>{item.body}</p>
      </article>):<p className="empty-inline">Todavía no hay mensajes.</p>}</div>
    </section>

    <section className="panel collab-wide">
      <div className="panel-title"><div><span className="eyebrow">CAMBIOS PROPUESTOS</span><h2>Propuestas</h2></div></div>
      <div className="proposal-layout">
        <form className="stack-form" onSubmit={submitProposal}>
          <label>Para<select value={proposalTo} onChange={event=>setProposalTo(event.target.value)}>{others.map(member=><option key={member.username} value={member.username}>{member.name}</option>)}</select></label>
          <label>Tarea relacionada<select value={proposalTaskId} onChange={event=>setProposalTaskId(event.target.value)}><option value="">General</option>{tasks.filter(task=>!task.done).map(task=><option key={task.id} value={task.id}>{task.title}</option>)}</select></label>
          <label>Título<input value={proposalTitle} onChange={event=>setProposalTitle(event.target.value)} placeholder="Ej. Cambiar fecha" required/></label>
          <label>Propuesta<textarea rows={4} value={proposalBody} onChange={event=>setProposalBody(event.target.value)} placeholder="Qué cambiarías y por qué" required/></label>
          <button className="primary" type="submit">Proponer cambio</button>
        </form>
        <div className="feed">{visibleProposals.length?visibleProposals.map(item=><article className="feed-card proposal" key={item.id}>
          <div><b>{item.title}</b><span> · @{item.createdBy} → @{item.recipientUsername}</span><small>{when(item.createdAt)}</small></div>
          <p>{item.body}</p>
          {item.taskId&&<small>Tarea: {tasks.find(task=>task.id===item.taskId)?.title??item.taskId}</small>}
          <div className={`proposal-status ${item.status}`}>{item.status==='pending'?'Pendiente':item.status==='accepted'?'Aceptada':'Rechazada'}</div>
          {item.status==='pending'&&item.recipientUsername===session?.username&&<div className="decision-actions">
            <button className="secondary" onClick={()=>decideProposal(item.id,'accepted')}><Check size={15}/> Aceptar</button>
            <button className="ghost" onClick={()=>decideProposal(item.id,'rejected')}><X size={15}/> Rechazar</button>
          </div>}
        </article>):<p className="empty-inline">No hay propuestas todavía.</p>}</div>
      </div>
    </section>
  </div>
}

function CreateUserForm({tenant,onCreated,onError}:{tenant:string;onCreated:(user:WorkspaceUser)=>void|Promise<void>;onError:(message:string)=>void}){
  const [username,setUsername]=useState('');
  const [name,setName]=useState('');
  const [password,setPassword]=useState('');
  const [tenants,setTenants]=useState<string[]>(tenant==='personal'?['personal']:['gatrivi']);
  const toggle=(value:string)=>setTenants(current=>current.includes(value)?current.filter(item=>item!==value):[...current,value]);
  const submit=async(event:FormEvent)=>{
    event.preventDefault();
    onError('');
    try{
      const user=await createUser({username,name,password,tenants});
      setUsername('');setName('');setPassword('');
      await onCreated(user);
    }catch(error){onError(error instanceof Error?error.message:'No se pudo crear el usuario.')}
  };
  return <form className="create-user" onSubmit={submit}>
    <div className="form-grid"><label>Usuario<input value={username} onChange={event=>setUsername(event.target.value)} required/></label><label>Nombre<input value={name} onChange={event=>setName(event.target.value)} required/></label></div>
    <label>Contraseña<input type="password" value={password} onChange={event=>setPassword(event.target.value)} minLength={4} required/></label>
    <div className="workspace-checks"><label><input type="checkbox" checked={tenants.includes('personal')} onChange={()=>toggle('personal')}/> Personal</label><label><input type="checkbox" checked={tenants.includes('gatrivi')} onChange={()=>toggle('gatrivi')}/> Gatrivi</label></div>
    <button className="primary" type="submit">Crear usuario</button>
  </form>
}
