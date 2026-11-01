import React, { useEffect, useState } from 'react';
import { suggestedCellSize } from '../../domain/grid.js';
import { gridSchema, type Grid } from '../../shared/campaign.js';
export function GridControls({ grid, onGrid, width, height }: { grid: Grid; onGrid: (grid: Grid) => void; width: number; height: number }) {
  const [metres,setMetres] = useState(String(grid.metersPerCell));
  const [size, setSize] = useState(String(grid.cellSizePx));
  const [x, setX] = useState(String(grid.originPx.x));
  const [y, setY] = useState(String(grid.originPx.y));
  useEffect(() => { setMetres(String(grid.metersPerCell)); setSize(String(grid.cellSizePx)); setX(String(grid.originPx.x)); setY(String(grid.originPx.y)); }, [grid.cellSizePx,grid.originPx.x,grid.originPx.y,grid.metersPerCell]);
  const [profile,setProfile] = useState(grid.locationKind==='forest'?'forest':'house');
  const [cellsAcross,setCellsAcross] = useState(grid.locationKind==='forest'?'40':'12');
  const [error, setError] = useState('');
  return <form className="grid-controls" noValidate onSubmit={event => {
    event.preventDefault();
    const result = gridSchema.safeParse({metersPerCell:metres.trim()?Number(metres):NaN,locationKind:grid.locationKind,cellSizePx: size.trim() ? Number(size) : NaN, originPx: {x:x.trim() ? Number(x) : NaN,y:y.trim() ? Number(y) : NaN},visible:grid.visible});
    if (!result.success) { setError('Размер клетки: от 4 до 4096 пикселей. Смещения: от −8192 до 8192. Метров на клетку: от 0.1 до 1000. Все поля должны содержать числа.'); return; }
    setError(''); onGrid(result.data);
  }}>
    <h3>Квадратная сетка</h3>
    <div className="grid-fields">
      <label>Визуальный пресет<select value={profile} onChange={event => {setProfile(event.target.value);setCellsAcross(event.target.value==='house'?'12':'40');setMetres(event.target.value==='house'?'1':'5');}}><option value="house">Дом — крупная сетка</option><option value="forest">Лес — мелкая сетка</option></select></label>
      <label>Клеток по короткой стороне<input type="number" min="1" max="2048" step="1" value={cellsAcross} onChange={event => setCellsAcross(event.target.value)} /></label>
      <button type="button" onClick={() => {
        const count=Number(cellsAcross);
        if(!Number.isInteger(count)||count<1||count>2048) {setError('Укажите от 1 до 2048 клеток по короткой стороне.');return;}
        const proposed=gridSchema.safeParse({...grid,locationKind:profile,metersPerCell:metres.trim()?Number(metres):NaN,cellSizePx:suggestedCellSize(width,height,count),visible:true});
        if(!proposed.success){setError('Метров на клетку: от 0.1 до 1000.');return;}
        setError('');onGrid(proposed.data);
      }}>Подобрать размер</button>
    </div>
    <p className="hint">Пресет учитывает размеры изображения: дом — 12, лес — 40 клеток по короткой стороне по умолчанию. Это редактируемые предложения, а не распознавание картинки: дом — 1 м/клетку, лес — 5 м/клетку по умолчанию. Стоимость движения будет задаваться отдельно. Для точного масштаба используйте отрезок ниже.</p>
    <label>Метров на клетку<input type="number" min="0.1" max="1000" step="any" value={metres} onChange={event => setMetres(event.target.value)} /></label>
    {grid.locationKind==='custom' && <p className="hint">Для новой или старой карты без физического масштаба предложено 1 м/клетку. Уточните значение перед измерениями.</p>}
    <p className="hint">Размер карты по текущей калибровке: примерно {(width/grid.cellSizePx*grid.metersPerCell).toFixed(1)} × {(height/grid.cellSizePx*grid.metersPerCell).toFixed(1)} м.</p>
    <label className="grid-toggle"><input type="checkbox" checked={grid.visible} onChange={event => onGrid({...grid,visible:event.target.checked})} />Показать сетку</label>
    <div className="grid-fields">
      <label>Размер клетки, пикс.<input type="number" min="4" max="4096" step="any" value={size} onChange={event => setSize(event.target.value)} /></label>
      <label>Смещение X, пикс.<input type="number" min="-8192" max="8192" step="any" value={x} onChange={event => setX(event.target.value)} /></label>
      <label>Смещение Y, пикс.<input type="number" min="-8192" max="8192" step="any" value={y} onChange={event => setY(event.target.value)} /></label>
    </div>
    <button type="submit">Применить сетку</button>
    {error && <p role="alert">{error}</p>}
    <p className="hint">Значения заданы в пикселях исходной карты. Подберите размер клетки и смещения, нажмите «Применить сетку», затем сохраните партию. Дробные значения допустимы.</p>
  </form>;
}
