globalThis.HidariOverlay={
  attach(host,handle,onPosition) {
    let position=null,drag=null;
    const clamp=(value,min,max)=>Math.min(Math.max(value,min),Math.max(min,max));
    function apply(next) {
      const width=clamp(next.width || 620,200,Math.min(800,innerWidth-24));
      host.style.position='fixed';host.style.width=width+'px';host.style.maxWidth='calc(100vw - 24px)';
      host.style.maxHeight='calc(100vh - 24px)';host.style.overflow='auto';host.style.zIndex='2147483647';
      host.style.margin='0';
      const height=host.getBoundingClientRect().height || 160;
      position={left:clamp(next.left,12,innerWidth-width-12),top:clamp(next.top,12,innerHeight-height-12),width};
      host.style.left=position.left+'px';host.style.top=position.top+'px';
      host.dataset.floating='true';
    }
    function reset() {
      position=null;drag=null;
      for(const property of ['position','width','max-width','max-height','overflow','z-index','margin','left','top'])host.style.removeProperty(property);
      delete host.dataset.floating;
    }
    handle.addEventListener('pointerdown',event=>{
      if(event.button!==0 || event.target.closest('button,a,input,summary'))return;
      const bounds=host.getBoundingClientRect();
      apply({left:bounds.left,top:bounds.top,width:bounds.width});
      document.documentElement.append(host);
      drag={id:event.pointerId,x:event.clientX,y:event.clientY,left:position.left,top:position.top};
      handle.setPointerCapture(event.pointerId);event.preventDefault();
    });
    handle.addEventListener('pointermove',event=>{
      if(!drag || event.pointerId!==drag.id)return;
      apply({...position,left:drag.left+event.clientX-drag.x,top:drag.top+event.clientY-drag.y});
    });
    const finish=event=>{
      if(!drag || drag.id!==event.pointerId)return;
      if(handle.hasPointerCapture?.(event.pointerId))handle.releasePointerCapture(event.pointerId);
      drag=null;onPosition({...position});
    };
    handle.addEventListener('pointerup',finish);handle.addEventListener('pointercancel',finish);
    handle.addEventListener('keydown',event=>{
      const delta={ArrowLeft:[-12,0],ArrowRight:[12,0],ArrowUp:[0,-12],ArrowDown:[0,12]}[event.key];
      if(!delta || event.target!==handle)return;
      const rect=host.getBoundingClientRect();
      apply({left:rect.left+delta[0],top:rect.top+delta[1],width:rect.width});
      document.documentElement.append(host);onPosition({...position});event.preventDefault();
    });
    addEventListener('resize',()=>{if(position)apply(position);});
    return {get floating(){return Boolean(position);},restore(next){if(next && [next.left,next.top,next.width].every(Number.isFinite))apply(next);else reset();},reset(){reset();onPosition(null);}};
  }
};
