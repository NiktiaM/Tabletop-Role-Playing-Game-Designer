import React, { useState } from 'react';
import { gridSchema, type Grid } from '../../shared/campaign.js';
export function GridControls({ grid, onGrid }: { grid: Grid; onGrid: (grid: Grid) => void }) {
  const [size, setSize] = useState(String(grid.cellSizePx));
  const [x, setX] = useState(String(grid.originPx.x));
  const [y, setY] = useState(String(grid.originPx.y));
  const [error, setError] = useState('');
  return <form className="grid-controls" noValidate onSubmit={event => {
    event.preventDefault();
    const result = gridSchema.safeParse({cellSizePx: size.trim() ? Number(size) : NaN, originPx: {x:x.trim() ? Number(x) : NaN,y:y.trim() ? Number(y) : NaN},visible:grid.visible});
    if (!result.success) { setError('Размер клетки: от 4 до 4096 пикселей. Смещения: от −8192 до 8192. Все поля должны содержать числа.'); return; }
    setError(''); onGrid(result.data);
  }}>
    <h3>Квадратная сетка</h3>
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
