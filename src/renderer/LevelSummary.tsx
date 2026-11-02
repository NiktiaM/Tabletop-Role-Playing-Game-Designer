import React from 'react';
import type {Character} from '../shared/campaign.js';
import type {Ruleset} from '../shared/rules.js';
import {characterLevel,npcExperience} from '../domain/progression.js';
export function LevelSummary({character,rules}:{character:Character;rules:Ruleset}){
 try{return <p className="level-summary">Уровень: <strong>{characterLevel(character,rules)}</strong>{character.kind==='npc'&&<> · Награда за победу: <strong>{npcExperience(character,rules)} опыта</strong></>}{character.kind==='character'&&<> · Опыт: {character.experience??0}</>}</p>;}catch(e){return <p role="alert">{e instanceof Error?e.message:'Проверьте уровень и формулу опыта'}</p>;}
}
