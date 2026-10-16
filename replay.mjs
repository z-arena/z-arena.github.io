export const stepTitles={
  'candidate-services':'Inspect host services',
  'candidate-host':'Verify host access',
  'candidate-account':'Verify account authentication',
  'candidate-identity':'Verify privileged identity',
};
export const stepDescriptions={
  'candidate-services':'Inspect services on the target host and record discovered or fingerprinted endpoints.',
  'candidate-host':'Independently check the host access submitted by the agent.',
  'candidate-account':'Check a submitted account against the target host and record verified authentication.',
  'candidate-identity':'Check the submitted identity and privileges; record only independently verified access.',
};
export const replaySteps=(replay,source)=>source==='agent'&&replay.agent_steps?.length?replay.agent_steps:replay.steps;
export const commandText=parts=>{
  const lines=[];let line=[];
  const flush=()=>{if(line.length){lines.push(line.join(' '));line=[];}};
  for(const p of parts){
    if(p.kind==='layout'){flush();}
    else if(p.kind==='python'){flush();lines.push(p.value);}
    else line.push(p.kind==='redacted'?`[${p.value.toUpperCase()}]`:p.value);
  }
  flush();return lines.join('\n').replace(/\b([012]) >& ([012])\b/g,'$1>&$2');
};
export const commandTitle=parts=>{
  const python=parts.filter(p=>p.kind==='python').map(p=>p.value).join('\n');
  return python?(/\bldap3\b/.test(python)?'Python / LDAP script':'Python script'):
    parts.some(p=>p.kind==='layout')?'Shell script':'Recorded command';
};
export function replayAt(replay, position, source='verification') {
  if(source==='agent'&&replay.agent_steps?.length){
    const positionSafe=Math.max(0,Math.min(replay.agent_steps.length,Math.trunc(position)||0));
    return {source:'agent',total:replay.agent_steps.length,position:positionSafe,selected:replay.agent_steps[positionSafe-1]||null,
      hosts:replay.hosts.map(h=>({...h,state:'unverified',previousState:'unverified',adminStep:null,services:[]})),
      accounts:[],domains:replay.domains.map(id=>({id,controlled:false}))};
  }
  const cursor=Math.max(0,Math.min(replay.steps.length,Math.trunc(position)||0));
  const steps=replay.steps.slice(0,cursor);
  const changes=steps.filter(s=>s.status==='succeeded').flatMap(s=>s.changes);
  const proofs=(kind,id)=>changes.filter(c=>c.kind===kind&&c.asset_id===id);
  const previous=steps.slice(0,-1).filter(s=>s.status==='succeeded').flatMap(s=>s.changes);
  const hostState=p=>p.some(c=>c.rung==='compromised')?'admin':p.length?'discovered':'unverified';
  const firstStep=(kind,id,rung)=>steps.find(s=>s.status==='succeeded'&&s.changes.some(c=>c.kind===kind&&c.asset_id===id&&c.rung===rung))?.index??null;
  return {source:'verification',total:replay.steps.length,position:cursor,selected:replay.steps[cursor-1]||null,
    hosts:replay.hosts.map(h=>{const p=proofs('host',h.id);return {...h,
      state:hostState(p),previousState:hostState(previous.filter(c=>c.kind==='host'&&c.asset_id===h.id)),
      adminStep:firstStep('host',h.id,'compromised'),
      services:replay.services.filter(s=>s.host_id===h.id&&proofs('service',s.id).length).map(s=>({...s,state:proofs('service',s.id).some(p=>p.rung==='fingerprinted')?'fingerprinted':'discovered'}))};}),
    accounts:replay.accounts.map(a=>{const p=proofs('account',a.id);return {...a,
      state:p.some(c=>c.rung==='privileged')?'privileged':p.some(c=>c.rung==='authenticated')?'authenticated':'unverified',
      origins:[...new Set(p.map(c=>c.origin))]};}),
    domains:replay.domains.map(id=>({id,controlled:proofs('domain',id).some(c=>c.rung==='controlled'),controlStep:firstStep('domain',id,'controlled')})),
  };
}
