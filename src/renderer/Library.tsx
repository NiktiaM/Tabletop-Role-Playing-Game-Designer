import React,{useLayoutEffect,useRef} from 'react';

/** The collection and its inspector scroll independently; headers remain visible. */
export function Library({title,subtitle,count,actions,tools,list,children,className='',detailKey,listKey}:{
 title:string;subtitle:string;count:number;actions?:React.ReactNode;
 tools:React.ReactNode;list:React.ReactNode;children:React.ReactNode;className?:string;detailKey?:string;listKey?:string;
}){
 const detail=useRef<HTMLDivElement>(null),browser=useRef<HTMLElement>(null);
 useLayoutEffect(()=>{if(detail.current)detail.current.scrollTop=0;},[detailKey]);
 useLayoutEffect(()=>{if(browser.current)browser.current.scrollTop=0;},[listKey]);
 useLayoutEffect(()=>{browser.current?.querySelector('[aria-pressed="true"]')?.scrollIntoView({block:'nearest',inline:'nearest'});},[detailKey,listKey]);
 return <section className={`library ${className}`} aria-label={title}>
  <header className="library-header"><div><h2>{title} <span className="library-count">{count}</span></h2><p>{subtitle}</p></div><div className="library-actions">{actions}</div></header>
  <div className="library-workspace"><aside className="library-browser" aria-label={`Список: ${title}`}><div className="library-tools">{tools}</div><nav ref={browser} className="library-list" aria-label={`Записи: ${title}`}>{list}</nav></aside><div ref={detail} className="library-detail" aria-label={`Карточка: ${title}`}>{children}</div></div>
 </section>;
}
export function LibraryEntry({id,name,meta,image,selected,onSelect}:{id:string;name:string;meta:string;image?:string|null;selected:boolean;onSelect:()=>void}){
 return <button type="button" className="library-entry" data-entry={id} aria-pressed={selected} onClick={onSelect}>{image?<img src={image} alt=""/>:<span className="library-avatar" aria-hidden="true">{name.slice(0,1)}</span>}<span className="library-entry-text"><strong>{name}</strong><small>{meta}</small></span><span className="library-chevron" aria-hidden="true">›</span></button>;
}
export function EmptyLibrary({children}:{children:React.ReactNode}){return <div className="library-empty">{children}</div>;}
