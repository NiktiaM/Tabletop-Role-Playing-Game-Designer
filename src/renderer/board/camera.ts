import type { Camera } from '../../shared/campaign.js';
export function zoomAt(camera: Camera, x: number, y: number, factor: number): Camera {
  const zoom = Math.max(0.02, Math.min(8, camera.zoom * factor));
  return { zoom, x: x - (x - camera.x) * zoom / camera.zoom, y: y - (y - camera.y) * zoom / camera.zoom };
}
export function fitCamera(width: number, height: number, viewportWidth: number, viewportHeight: number): Camera {
  const zoom = Math.max(0.02, Math.min(8, (viewportWidth - 32) / width, (viewportHeight - 32) / height));
  return { zoom, x: (viewportWidth - width * zoom) / 2, y: (viewportHeight - height * zoom) / 2 };
}
