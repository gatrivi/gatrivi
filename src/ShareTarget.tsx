import {Navigate,useLocation} from 'react-router-dom';
import {getSession} from './services/auth';

function encodeProspectSearch(search:string){
  const shared=new URLSearchParams(search);
  const target=new URLSearchParams({shared:'1'});
  const title=shared.get('title');
  const text=shared.get('text');
  const url=shared.get('url');
  if(title)target.set('title',title);
  if(text)target.set('text',text);
  if(url)target.set('source',url);
  return target.toString();
}

export default function ShareTarget(){
  const location=useLocation();
  const session=getSession();
  if(!session){
    const next=`${location.pathname}${location.search}`;
    return <Navigate to={`/login?next=${encodeURIComponent(next)}`} replace/>;
  }
  return <Navigate to={`/t/${session.tenant}/prospects?${encodeProspectSearch(location.search)}`} replace/>;
}
