'use client';

import { useEffect, useRef, useState } from 'react';
import { sitePath } from '../lib/site-path';
import { sceneDiagnostics } from '../lib/planet-telemetry';
import { DEFAULT_TRIP_ORIGIN, type TripOrigin } from '../lib/trip-origin';
import { routeMesh, ROUTE_COLORS, type MapRoute } from '../lib/route-ribbon';
import {
  ORBIT,
  cameraForKorea,
  cameraForDetail,
  interpolateCamera,
  projectLocation,
  placeJourneyLabels,
  lightStyleForZoom,
  type Camera,
} from '../lib/planet-camera';
import {
  vertexShader,
  fragmentShader,
  geographicVertexShader,
  lineFragmentShader,
  lightFragmentShader,
  clusterVertexShader,
  clusterFragmentShader,
  routeVertexShader,
  routeFragmentShader,
} from './planet-shaders';

type View = {
  activityId: string;
  locationName: string;
  longitude: number | null;
  latitude: number | null;
  intro: boolean;
  detailZoom: boolean;
  mapRoute: MapRoute | null;
  origin?: TripOrigin;
  onBrowseReady?: () => void;
};
type GeographyLabel = { name: string; longitude: number; latitude: number };
type SeoulGeography = {
  boundary: number[][][];
  districts: { name: string; lines: number[][][] }[];
  river: number[][][];
  riverHoles: number[][][];
  labels: GeographyLabel[];
};
type RegionalGeography = {
  provinceCount: number;
  cityCount: number;
  provinces: number[][][];
  cityGroups: {
    bounds: [number, number, number, number];
    lines: number[][][];
  }[];
};
type Program = {
  value: WebGLProgram;
  position: number;
  style: number;
  uniforms: Record<string, WebGLUniformLocation | null>;
};
const activateProgram = (gl: WebGL2RenderingContext, program: WebGLProgram) =>
  gl.useProgram(program);
const sameCamera = (a: Camera, b: Camera) =>
  Object.keys(a).every(
    (key) => a[key as keyof Camera] === b[key as keyof Camera],
  );

function compile(gl: WebGL2RenderingContext, type: number, source: string) {
  const shader = gl.createShader(type);
  if (!shader) throw new Error('Unable to allocate shader');
  try {
    gl.shaderSource(shader, source);
    gl.compileShader(shader);
    if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS))
      throw new Error(gl.getShaderInfoLog(shader) ?? 'Shader failed');
    return shader;
  } catch (error) {
    gl.deleteShader(shader);
    throw error;
  }
}
async function bitmap(url: string, signal: AbortSignal) {
  const response = await fetch(sitePath(url), { signal });
  if (!response.ok) throw new Error('Unable to load globe source');
  return createImageBitmap(await response.blob(), {
    imageOrientation: 'flipY',
    premultiplyAlpha: 'none',
    colorSpaceConversion: 'none',
  });
}

export function PlanetCanvas(props: View) {
  const {
    activityId,
    locationName,
    longitude,
    latitude,
    intro,
    detailZoom,
    mapRoute,
    origin = DEFAULT_TRIP_ORIGIN,
    onBrowseReady,
  } = props;
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const seoulLabel = useRef<HTMLSpanElement>(null);
  const destinationLabel = useRef<HTMLSpanElement>(null);
  const contextLabels = useRef(new Map<string, HTMLSpanElement>());
  const [geographyLabels, setGeographyLabels] = useState<GeographyLabel[]>([]);
  const viewRef = useRef(props);
  const updateRef = useRef<(() => void) | null>(null);
  const measureRef = useRef<(() => void) | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    let disposed = false;
    let frame = 0;
    let introTimer: ReturnType<typeof setTimeout> | undefined;
    let twinkleTimer: ReturnType<typeof setTimeout> | undefined;
    let startupTimer: ReturnType<typeof setTimeout> | undefined;
    const releases: (() => void)[] = [
      () => cancelAnimationFrame(frame),
      () => clearTimeout(introTimer),
      () => clearTimeout(twinkleTimer),
    ];
    const release = () => {
      if (disposed) return;
      disposed = true;
      clearTimeout(startupTimer);
      while (releases.length) {
        try {
          releases.pop()?.();
        } catch {
          /* Release the remaining owners even if a native cleanup fails. */
        }
      }
      measureRef.current = null;
      updateRef.current = null;
      canvas.dataset.twinkling = 'false';
      canvas.dataset.routeFlowing = 'false';
      canvas.dataset.animating = 'false';
      for (const label of [
        seoulLabel.current,
        destinationLabel.current,
        ...contextLabels.current.values(),
      ])
        if (label) label.style.opacity = '0';
    };
    const fail = (reason: string) => {
      if (disposed) return;
      canvas.dataset.renderer = 'unavailable';
      canvas.dataset.startupFailure = reason;
      release();
      if (!viewRef.current.detailZoom) viewRef.current.onBrowseReady?.();
    };
    try {
      startupTimer = setTimeout(() => fail('startup-timeout'), 18000);
      const gl = canvas.getContext('webgl2', {
        antialias: true,
        powerPreference: 'high-performance',
        alpha: false,
        stencil: true,
      });
      if (!gl) {
        fail('unsupported');
        return release;
      }
      const onContextLost = () => fail('context-lost');
      canvas.addEventListener('webglcontextlost', onContextLost);
      releases.push(() =>
        canvas.removeEventListener('webglcontextlost', onContextLost),
      );
      const stencilEnabled = Boolean(gl.getContextAttributes()?.stencil);
      const layout = { width: canvas.clientWidth, height: canvas.clientHeight };
      const labelSizes = new Map<
        HTMLSpanElement,
        { width: number; height: number }
      >();
      const observedLabels = new Set<HTMLSpanElement>();
      let layoutRevision = 0;
      let journeyLayout: {
        camera: Camera;
        route: MapRoute | null;
        revision: number;
        longitude: number;
        latitude: number;
        originLongitude: number;
        originLatitude: number;
        boxes: ReturnType<typeof placeJourneyLabels>;
      } | null = null;
      const layoutObserver = new ResizeObserver(() => {
        if (disposed) return;
        const resized =
          layout.width !== canvas.clientWidth ||
          layout.height !== canvas.clientHeight;
        measureLayout();
        if (!ready) return;
        draw();
        if (resized) update();
      });
      releases.push(() => {
        layoutObserver.disconnect();
        observedLabels.clear();
        labelSizes.clear();
      });
      const measureLayout = () => {
        layoutRevision++;
        layout.width = canvas.clientWidth;
        layout.height = canvas.clientHeight;
        const labels = [
          seoulLabel.current,
          destinationLabel.current,
          ...contextLabels.current.values(),
        ].filter((label): label is HTMLSpanElement => label !== null);
        for (const label of observedLabels) {
          if (!labels.includes(label)) {
            layoutObserver.unobserve(label);
            observedLabels.delete(label);
            labelSizes.delete(label);
          }
        }
        // Read all boxes together on resize/text changes, never between per-frame label writes.
        for (const label of labels) {
          if (!observedLabels.has(label)) {
            observedLabels.add(label);
            layoutObserver.observe(label);
          }
          const bounds = label.getBoundingClientRect();
          labelSizes.set(label, { width: bounds.width, height: bounds.height });
        }
      };
      layoutObserver.observe(canvas);
      measureRef.current = measureLayout;
      measureLayout();
      const publishDiagnostics = sceneDiagnostics(canvas.dataset);
      let diagnosticsDirty = true;
      const controller = new AbortController();
      releases.push(() => controller.abort());
      const reduced = matchMedia('(prefers-reduced-motion: reduce)');
      let ready = false,
        automaticFlight = false,
        animating = false,
        paused = false,
        inViewport = true;
      let started = 0,
        duration = 0,
        remaining = 0,
        draws = 0,
        mapStyle = 0,
        lightTime = 0,
        lightTick = 0;
      let current = ORBIT,
        destination = ORBIT;
      let targetPhase = 'orbit';
      let coastCount = 0,
        koreaCoastCount = 0,
        lightCount = 0,
        seoulLightCount = 0,
        routeCount = 0,
        clusterVertexCount = 0;
      let boundaryCount = 0,
        districtCount = 0;
      let provinceRange = { start: 0, count: 0 };
      const cityRanges: {
        start: number;
        count: number;
        bounds: [number, number, number, number];
      }[] = [];
      let localLabels: GeographyLabel[] = [];
      let uploadedRoute: MapRoute | null = null;
      let routeRanges: ReturnType<typeof routeMesh>['ranges'] = [];
      const riverRanges: { start: number; count: number }[] = [];
      const shaders: WebGLShader[] = [];
      const programs: WebGLProgram[] = [];
      const textures: WebGLTexture[] = [];
      const buffers: WebGLBuffer[] = [];
      const sizes: number[] = [];
      const common = [
        'Resolution',
        'Center',
        'Radius',
        'MapStyle',
        'Longitude',
        'Latitude',
        'PixelRatio',
        'PointSize',
        'Color',
        'Opacity',
        'Ring',
        'StrengthBoost',
        'Time',
        'RouteLength',
        'FlowEnabled',
      ];
      const link = (
        vertexSource: string,
        fragmentSource: string,
        attribute: string,
      ): Program => {
        const vertex = compile(gl, gl.VERTEX_SHADER, vertexSource);
        shaders.push(vertex);
        releases.push(() => gl.deleteShader(vertex));
        const fragment = compile(gl, gl.FRAGMENT_SHADER, fragmentSource);
        shaders.push(fragment);
        releases.push(() => gl.deleteShader(fragment));
        const value = gl.createProgram();
        if (!value) throw new Error('Unable to allocate program');
        programs.push(value);
        releases.push(() => gl.deleteProgram(value));
        gl.attachShader(value, vertex);
        gl.attachShader(value, fragment);
        gl.linkProgram(value);
        if (!gl.getProgramParameter(value, gl.LINK_STATUS))
          throw new Error(gl.getProgramInfoLog(value) ?? 'Program link failed');
        return {
          value,
          position: gl.getAttribLocation(value, attribute),
          style: gl.getAttribLocation(value, 'aStyle'),
          uniforms: Object.fromEntries(
            common.map((name) => [
              name,
              gl.getUniformLocation(value, 'u' + name),
            ]),
          ),
        };
      };
      const sphere = link(vertexShader, fragmentShader, 'aPosition');
      const lines = link(geographicVertexShader, lineFragmentShader, 'aGeo');
      const lights = link(geographicVertexShader, lightFragmentShader, 'aGeo');
      const clusters = link(clusterVertexShader, clusterFragmentShader, 'aGeo');
      const routeProgram = link(routeVertexShader, routeFragmentShader, 'aGeo');
      const makeBuffer = (data: Float32Array) => {
        const buffer = gl.createBuffer();
        if (!buffer) throw new Error('Unable to allocate buffer');
        buffers.push(buffer);
        releases.push(() => gl.deleteBuffer(buffer));
        gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
        gl.bufferData(gl.ARRAY_BUFFER, data, gl.STATIC_DRAW);
        return buffer;
      };
      const triangle = makeBuffer(new Float32Array([-1, -1, 3, -1, -1, 3]));
      const coastBuffer = makeBuffer(new Float32Array());
      const lightBuffer = makeBuffer(new Float32Array());
      const seoulLightBuffer = makeBuffer(new Float32Array());
      const haloBuffer = makeBuffer(new Float32Array());
      const routeBuffer = makeBuffer(new Float32Array());
      const endpointBuffer = makeBuffer(new Float32Array());
      const boundaryBuffer = makeBuffer(new Float32Array());
      const districtBuffer = makeBuffer(new Float32Array());
      const riverBuffer = makeBuffer(new Float32Array());
      activateProgram(gl, sphere.value);
      for (const [unit, name] of [
        'Day',
        'Night',
        'Clouds',
        'KoreaMask',
      ].entries()) {
        const texture = gl.createTexture();
        if (!texture) throw new Error('Unable to allocate texture');
        textures.push(texture);
        releases.push(() => gl.deleteTexture(texture));
        gl.activeTexture(gl.TEXTURE0 + unit);
        gl.bindTexture(gl.TEXTURE_2D, textures[unit]);
        gl.texParameteri(
          gl.TEXTURE_2D,
          gl.TEXTURE_MIN_FILTER,
          gl.LINEAR_MIPMAP_LINEAR,
        );
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
        gl.texParameteri(
          gl.TEXTURE_2D,
          gl.TEXTURE_WRAP_S,
          unit < 3 ? gl.REPEAT : gl.CLAMP_TO_EDGE,
        );
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
        gl.uniform1i(gl.getUniformLocation(sphere.value, 'u' + name), unit);
      }
      const loadTexture = async (url: string, unit: number) => {
        const image = await bitmap(url, controller.signal);
        if (disposed) {
          image.close();
          return;
        }
        try {
          gl.activeTexture(gl.TEXTURE0 + unit);
          gl.bindTexture(gl.TEXTURE_2D, textures[unit]);
          gl.texImage2D(
            gl.TEXTURE_2D,
            0,
            gl.RGBA,
            gl.RGBA,
            gl.UNSIGNED_BYTE,
            image,
          );
          gl.generateMipmap(gl.TEXTURE_2D);
          sizes[unit] = Math.ceil((image.width * image.height * 4 * 4) / 3);
        } finally {
          image.close();
        }
      };
      const bind = (program: Program, buffer: WebGLBuffer, ratio: number) => {
        activateProgram(gl, program.value);
        gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
        if (clusters.style >= 0) gl.disableVertexAttribArray(clusters.style);
        if (routeProgram.style >= 0)
          gl.disableVertexAttribArray(routeProgram.style);
        gl.enableVertexAttribArray(program.position);
        if (program.style >= 0) {
          gl.enableVertexAttribArray(program.style);
          gl.vertexAttribPointer(program.position, 4, gl.FLOAT, false, 32, 0);
          gl.vertexAttribPointer(program.style, 4, gl.FLOAT, false, 32, 16);
        } else if (buffer === lightBuffer || buffer === seoulLightBuffer) {
          gl.vertexAttribPointer(program.position, 4, gl.FLOAT, false, 16, 0);
        } else {
          gl.vertexAttribPointer(program.position, 2, gl.FLOAT, false, 0, 0);
        }
        gl.uniform2f(program.uniforms.Resolution, canvas.width, canvas.height);
        gl.uniform2f(
          program.uniforms.Center,
          ((current.anchorX * 2 - 1) * canvas.width) / canvas.height,
          1 - current.anchorY * 2,
        );
        gl.uniform1f(program.uniforms.Radius, current.radius);
        gl.uniform1f(program.uniforms.MapStyle, mapStyle);
        gl.uniform1f(program.uniforms.Time, lightTime);
        gl.uniform1f(
          program.uniforms.Longitude,
          (current.longitude * Math.PI) / 180,
        );
        gl.uniform1f(
          program.uniforms.Latitude,
          (current.latitude * Math.PI) / 180,
        );
        gl.uniform1f(program.uniforms.PixelRatio, ratio);
      };
      const setLabel = (
        label: HTMLSpanElement | null,
        lon: number,
        lat: number,
        enabled: boolean,
        below = false,
        context = false,
        strength = 1,
      ) => {
        if (!label) return;
        if (!enabled) {
          if (label.style.opacity !== '0') label.style.opacity = '0';
          return;
        }
        const size = labelSizes.get(label);
        if (!size) return;
        const point = projectLocation(
          current,
          lon,
          lat,
          layout.width,
          layout.height,
        );
        const { width, height } = size;
        const desktop = layout.width > 760;
        const limit =
          viewRef.current.detailZoom && desktop
            ? layout.width * 0.46
            : layout.width - 8;
        const bottom = layout.height * (desktop ? 0.88 : 0.35);
        if (
          context &&
          (point.x < width / 2 + 8 ||
            point.x > limit - width / 2 ||
            point.y < 100 ||
            point.y > bottom - height)
        )
          enabled = false;
        const opacity = enabled && point.visible ? String(strength) : '0';
        if (label.style.opacity !== opacity) label.style.opacity = opacity;
        if (opacity === '0') return;
        const x =
          point.x + 12 + width > limit ? point.x - width - 12 : point.x + 12;
        const labelX = Math.max(
          8,
          Math.min(limit - width, context ? point.x - width / 2 : x),
        );
        const labelY = Math.max(
          90,
          Math.min(
            bottom - height,
            context
              ? point.y - height / 2
              : below
                ? point.y + 12
                : point.y - height - 12,
          ),
        );
        const transform = 'translate3d(' + labelX + 'px,' + labelY + 'px,0)';
        if (label.style.transform !== transform)
          label.style.transform = transform;
        return { x: labelX, y: labelY, width, height };
      };
      const drawGeography = (ratio: number, opacity: number) => {
        if (opacity <= 0) return;
        bind(lines, riverBuffer, ratio);
        if (stencilEnabled) {
          // Even-odd stencil fill preserves concave banks and island holes without triangulation.
          gl.enable(gl.STENCIL_TEST);
          gl.stencilMask(0xff);
          gl.clearStencil(0);
          gl.clear(gl.STENCIL_BUFFER_BIT);
          gl.colorMask(false, false, false, false);
          gl.stencilFunc(gl.ALWAYS, 0, 0xff);
          gl.stencilOp(gl.KEEP, gl.KEEP, gl.INVERT);
          for (const ring of riverRanges)
            gl.drawArrays(gl.TRIANGLE_FAN, ring.start, ring.count);
          gl.colorMask(true, true, true, true);
          gl.stencilFunc(gl.NOTEQUAL, 0, 0xff);
          gl.stencilOp(gl.KEEP, gl.KEEP, gl.ZERO);
          gl.uniform3f(lines.uniforms.Color, 0.035, 0.16, 0.21);
          gl.uniform1f(lines.uniforms.Opacity, opacity * 0.96);
          for (const ring of riverRanges)
            gl.drawArrays(gl.TRIANGLE_FAN, ring.start, ring.count);
          gl.disable(gl.STENCIL_TEST);
        }
        gl.uniform3f(lines.uniforms.Color, 0.25, 0.53, 0.58);
        gl.uniform1f(lines.uniforms.Opacity, opacity * 0.62);
        for (const ring of riverRanges)
          gl.drawArrays(gl.LINE_STRIP, ring.start, ring.count);
        bind(lines, districtBuffer, ratio);
        gl.uniform3f(lines.uniforms.Color, 0.46, 0.62, 0.59);
        gl.uniform1f(lines.uniforms.Opacity, opacity * 0.24);
        gl.drawArrays(gl.LINES, 0, districtCount);
        bind(lines, boundaryBuffer, ratio);
        gl.uniform3f(lines.uniforms.Color, 0.5, 0.7, 0.65);
        gl.uniform1f(lines.uniforms.Opacity, opacity * 0.6);
        gl.drawArrays(gl.LINES, 0, boundaryCount);
      };
      const draw = (forceDiagnostics = false) => {
        if (!ready || disposed || document.hidden || !inViewport) return;
        try {
          const submitted = performance.now(),
            ratio = Math.min(devicePixelRatio, 2);
          const width = Math.round(layout.width * ratio),
            height = Math.round(layout.height * ratio);
          if (canvas.width !== width || canvas.height !== height) {
            canvas.width = width;
            canvas.height = height;
            gl.viewport(0, 0, width, height);
          }
          gl.disable(gl.BLEND);
          bind(sphere, triangle, ratio);
          gl.drawArrays(gl.TRIANGLES, 0, 3);
          gl.enable(gl.BLEND);
          gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
          const focus = mapStyle;
          bind(lines, coastBuffer, ratio);
          gl.uniform3f(lines.uniforms.Color, 0.29, 0.48, 0.52);
          gl.uniform1f(lines.uniforms.Opacity, focus * 0.45);
          gl.drawArrays(gl.LINES, 0, koreaCoastCount);
          gl.uniform1f(lines.uniforms.Opacity, focus * 0.18);
          gl.drawArrays(
            gl.LINES,
            koreaCoastCount,
            coastCount - koreaCoastCount,
          );
          if (provinceRange.count) {
            bind(lines, districtBuffer, ratio);
            gl.uniform3f(lines.uniforms.Color, 0.46, 0.62, 0.59);
            gl.uniform1f(lines.uniforms.Opacity, focus * 0.3);
            gl.drawArrays(gl.LINES, provinceRange.start, provinceRange.count);
            const cityOpacity = Math.max(
              0,
              Math.min(1, (current.radius - 18) / 45),
            );
            if (cityOpacity > 0) {
              gl.uniform1f(lines.uniforms.Opacity, focus * cityOpacity * 0.24);
              for (const range of cityRanges) {
                const [west, south, east, north] = range.bounds;
                const corners = [
                  [west, south],
                  [west, north],
                  [east, south],
                  [east, north],
                ].map(([lon, lat]) =>
                  projectLocation(
                    current,
                    lon,
                    lat,
                    layout.width,
                    layout.height,
                  ),
                );
                if (
                  Math.max(...corners.map((p) => p.x)) < 0 ||
                  Math.min(...corners.map((p) => p.x)) > layout.width ||
                  Math.max(...corners.map((p) => p.y)) < 0 ||
                  Math.min(...corners.map((p) => p.y)) > layout.height
                )
                  continue;
                gl.drawArrays(gl.LINES, range.start, range.count);
              }
            }
          }
          bind(clusters, haloBuffer, ratio);
          gl.uniform1f(clusters.uniforms.Opacity, focus);
          gl.drawArrays(gl.TRIANGLES, 0, clusterVertexCount);
          bind(lights, lightBuffer, ratio);
          const lightStyle = lightStyleForZoom(current.radius);
          gl.uniform1f(lights.uniforms.PointSize, lightStyle.pointSize);
          gl.uniform1f(lights.uniforms.StrengthBoost, lightStyle.strengthBoost);
          gl.uniform1f(lights.uniforms.Ring, 0);
          gl.uniform3f(lights.uniforms.Color, 1, 0.76, 0.24);
          gl.uniform1f(lights.uniforms.Opacity, focus * 0.95);
          gl.drawArrays(gl.POINTS, 0, lightCount);
          const view = viewRef.current;
          const located = view.longitude !== null && view.latitude !== null;
          const localOpacity = view.detailZoom
            ? Math.max(0, Math.min(1, (current.radius - 40) / 100))
            : 0;
          const seoulLightOpacity = Math.max(
            0,
            Math.min(1, (current.radius - 45) / 100),
          );
          if (seoulLightCount && seoulLightOpacity > 0) {
            bind(lights, seoulLightBuffer, ratio);
            gl.uniform1f(lights.uniforms.PointSize, 16);
            gl.uniform1f(lights.uniforms.StrengthBoost, 0.12);
            gl.uniform1f(lights.uniforms.Ring, 0);
            gl.uniform3f(lights.uniforms.Color, 1, 0.76, 0.24);
            gl.uniform1f(
              lights.uniforms.Opacity,
              seoulLightOpacity * focus * 0.9,
            );
            gl.drawArrays(gl.POINTS, 0, seoulLightCount);
          }
          drawGeography(ratio, localOpacity);
          if (view.detailZoom && located) {
            if (routeRanges.length) {
              bind(routeProgram, routeBuffer, ratio);
              gl.uniform1f(routeProgram.uniforms.Opacity, focus);
              for (const range of routeRanges) {
                const color = ROUTE_COLORS[range.mode];
                gl.uniform3f(
                  routeProgram.uniforms.Color,
                  color[0] / 255,
                  color[1] / 255,
                  color[2] / 255,
                );
                gl.uniform1f(
                  routeProgram.uniforms.PointSize,
                  range.mode === 'walk' ? 3.2 : 4.4,
                );
                gl.uniform1f(routeProgram.uniforms.RouteLength, range.lengthKm);
                gl.uniform1f(
                  routeProgram.uniforms.FlowEnabled,
                  reduced.matches || range.mode === 'walk' ? 0 : 1,
                );
                gl.uniform1f(routeProgram.uniforms.Ring, 1);
                gl.drawArrays(gl.TRIANGLES, range.start, range.count);
                gl.uniform1f(routeProgram.uniforms.Ring, 0);
                gl.drawArrays(gl.TRIANGLES, range.start, range.count);
              }
            }
            bind(lights, endpointBuffer, ratio);
            gl.uniform1f(lights.uniforms.PointSize, 30);
            gl.uniform1f(lights.uniforms.Ring, 1);
            gl.uniform3f(lights.uniforms.Color, 1, 0.25, 0.2);
            gl.uniform1f(lights.uniforms.Opacity, focus);
            gl.drawArrays(gl.POINTS, 0, 2);
          }
          const origin = view.origin ?? DEFAULT_TRIP_ORIGIN;
          const originPoint = projectLocation(
            current,
            origin.longitude,
            origin.latitude,
            layout.width,
            layout.height,
          );
          const destinationPoint = projectLocation(
            current,
            view.longitude ?? origin.longitude,
            view.latitude ?? origin.latitude,
            layout.width,
            layout.height,
          );
          const originSize =
            seoulLabel.current && labelSizes.get(seoulLabel.current);
          const destinationSize =
            destinationLabel.current &&
            labelSizes.get(destinationLabel.current);
          if (
            view.detailZoom &&
            located &&
            originSize &&
            destinationSize &&
            originPoint.visible &&
            destinationPoint.visible
          ) {
            if (
              !journeyLayout ||
              journeyLayout.camera !== current ||
              journeyLayout.route !== uploadedRoute ||
              journeyLayout.revision !== layoutRevision ||
              journeyLayout.longitude !== view.longitude ||
              journeyLayout.latitude !== view.latitude ||
              journeyLayout.originLongitude !== origin.longitude ||
              journeyLayout.originLatitude !== origin.latitude
            ) {
              const paths = (uploadedRoute?.segments ?? []).map((segment) =>
                segment.path.map(([lon, lat]) =>
                  projectLocation(
                    current,
                    lon,
                    lat,
                    layout.width,
                    layout.height,
                  ),
                ),
              );
              const boxes = placeJourneyLabels(
                { ...originPoint, ...originSize },
                { ...destinationPoint, ...destinationSize },
                {
                  left: 8,
                  top: 90,
                  right:
                    layout.width > 760 ? layout.width * 0.46 : layout.width - 8,
                  bottom: layout.height * (layout.width > 760 ? 0.88 : 0.35),
                },
                paths,
              );
              journeyLayout = {
                camera: current,
                route: uploadedRoute,
                revision: layoutRevision,
                longitude: view.longitude!,
                latitude: view.latitude!,
                originLongitude: origin.longitude,
                originLatitude: origin.latitude,
                boxes,
              };
            }
            for (const [label, box] of [
              [seoulLabel.current, journeyLayout.boxes[0]],
              [destinationLabel.current, journeyLayout.boxes[1]],
            ] as const) {
              if (!label) continue;
              if (label.style.opacity !== '1') label.style.opacity = '1';
              const transform = `translate3d(${box.x}px,${box.y}px,0)`;
              if (label.style.transform !== transform)
                label.style.transform = transform;
            }
          } else {
            for (const label of [seoulLabel.current, destinationLabel.current])
              if (label && label.style.opacity !== '0')
                label.style.opacity = '0';
          }
          for (const label of localLabels) {
            const point = projectLocation(
              current,
              label.longitude,
              label.latitude,
              layout.width,
              layout.height,
            );
            const clearance = label.name === 'Han River' ? 38 : 85;
            const clear =
              Math.hypot(point.x - originPoint.x, point.y - originPoint.y) >
                clearance &&
              Math.hypot(
                point.x - destinationPoint.x,
                point.y - destinationPoint.y,
              ) > clearance;
            setLabel(
              contextLabels.current.get(label.name) ?? null,
              label.longitude,
              label.latitude,
              localOpacity > 0 && clear,
              false,
              true,
              localOpacity * 0.8,
            );
          }
          draws++;
          const now = performance.now();
          publishDiagnostics(
            now,
            () => ({
              draws: String(draws),
              drawMs: (now - submitted).toFixed(2),
              radius: current.radius.toFixed(6),
              mapStyle: mapStyle.toFixed(3),
              lightTime: lightTime.toFixed(3),
              longitude: current.longitude.toFixed(6),
              latitude: current.latitude.toFixed(6),
              anchorX: current.anchorX.toFixed(6),
              anchorY: current.anchorY.toFixed(6),
              endpointCount: view.detailZoom && located ? '2' : '0',
              localGeographyOpacity: localOpacity.toFixed(3),
              lightPointSize: lightStyle.pointSize.toFixed(3),
              lightStrengthBoost: lightStyle.strengthBoost.toFixed(3),
              seoulLightOpacity: seoulLightOpacity.toFixed(3),
              routeVertexCount: String(view.detailZoom ? routeCount : 0),
              routeProvider: view.mapRoute?.provider ?? 'none',
              routeMode: view.mapRoute?.mode ?? 'none',
              routeModes: routeRanges.map((range) => range.mode).join(','),
              routeWidth: '4.4',
              routeFlowing: String(
                view.detailZoom &&
                  routeCount > 1 &&
                  !reduced.matches &&
                  !animating,
              ),
            }),
            forceDiagnostics || diagnosticsDirty,
          );
          diagnosticsDirty = false;
        } catch {
          fail('rendering');
        }
      };
      const stopTwinkle = () => {
        clearTimeout(twinkleTimer);
        twinkleTimer = undefined;
        canvas.dataset.twinkling = 'false';
        canvas.dataset.routeFlowing = 'false';
      };
      const startTwinkle = () => {
        stopTwinkle();
        if (
          !ready ||
          disposed ||
          document.hidden ||
          !inViewport ||
          reduced.matches ||
          animating ||
          mapStyle === 0
        )
          return;
        canvas.dataset.twinkling = 'true';
        lightTick = performance.now();
        const tick = () => {
          const now = performance.now();
          lightTime += (now - lightTick) / 1000;
          lightTick = now;
          draw();
          if (!disposed) twinkleTimer = setTimeout(tick, 1000 / 12);
        };
        twinkleTimer = setTimeout(tick, 1000 / 12);
      };
      const fly = (
        target: Camera,
        milliseconds: number,
        phase: string,
        resume = false,
      ) => {
        if (!ready || disposed) return;
        if (!resume && sameCamera(target, destination) && (animating || paused))
          return;
        destination = target;
        targetPhase = phase;
        cancelAnimationFrame(frame);
        stopTwinkle();
        if (sameCamera(current, target)) {
          mapStyle = 1;
          animating = false;
          paused = false;
          canvas.dataset.phase = phase;
          canvas.dataset.animating = 'false';
          draw();
          startTwinkle();
          if (phase === 'korea') viewRef.current.onBrowseReady?.();
          return;
        }
        const start = current;
        const startStyle = mapStyle;
        started = performance.now();
        duration = reduced.matches ? 1 : milliseconds;
        remaining = duration;
        if (document.hidden || !inViewport) {
          paused = true;
          animating = false;
          return;
        }
        animating = true;
        paused = false;
        canvas.dataset.phase = 'flight';
        canvas.dataset.animating = 'true';
        const tick = (now: number) => {
          if (disposed || document.hidden || !inViewport) return;
          const progress = Math.min(1, (now - started) / duration);
          const eased =
            progress < 0.5
              ? 4 * progress * progress * progress
              : 1 - Math.pow(-2 * progress + 2, 3) / 2;
          current = interpolateCamera(start, target, eased);
          mapStyle = startStyle + (1 - startStyle) * eased;
          draw(progress === 1);
          if (disposed) return;
          if (progress < 1) frame = requestAnimationFrame(tick);
          else {
            animating = false;
            canvas.dataset.phase = phase;
            canvas.dataset.animating = 'false';
            startTwinkle();
            if (phase === 'korea') viewRef.current.onBrowseReady?.();
          }
        };
        frame = requestAnimationFrame(tick);
      };
      const update = () => {
        if (disposed) return;
        diagnosticsDirty = true;
        if (!ready) {
          if (
            canvas.dataset.renderer === 'unavailable' &&
            !viewRef.current.detailZoom
          )
            viewRef.current.onBrowseReady?.();
          return;
        }
        const view = viewRef.current;
        const origin = view.origin ?? DEFAULT_TRIP_ORIGIN;
        const longitude = view.longitude ?? origin.longitude;
        const latitude = view.latitude ?? origin.latitude;
        const selectedRoute =
          view.detailZoom && view.mapRoute?.activityId === view.activityId
            ? view.mapRoute
            : null;
        const path =
          selectedRoute?.segments.flatMap((segment) => segment.path) ?? [];
        routeCount = path.length;
        if (selectedRoute !== uploadedRoute) {
          const mesh = routeMesh(selectedRoute?.segments ?? []);
          routeRanges = mesh.ranges;
          gl.bindBuffer(gl.ARRAY_BUFFER, routeBuffer);
          gl.bufferData(gl.ARRAY_BUFFER, mesh.vertices, gl.STATIC_DRAW);
          uploadedRoute = selectedRoute;
        }
        gl.bindBuffer(gl.ARRAY_BUFFER, endpointBuffer);
        gl.bufferData(
          gl.ARRAY_BUFFER,
          new Float32Array([
            origin.longitude,
            origin.latitude,
            longitude,
            latitude,
          ]),
          gl.STATIC_DRAW,
        );
        if (view.intro && !automaticFlight) return;
        clearTimeout(introTimer);
        let target =
          view.detailZoom && view.longitude !== null && view.latitude !== null
            ? cameraForDetail(
                view.longitude,
                view.latitude,
                layout.width,
                layout.height,
                path,
                origin,
              )
            : cameraForKorea(
                layout.width,
                layout.height,
                Math.min(devicePixelRatio, 2),
              );
        if (
          view.detailZoom &&
          (view.longitude === null || view.latitude === null)
        )
          target = {
            ...target,
            anchorX: layout.width > 760 ? 0.24 : 0.5,
            anchorY: layout.width > 760 ? 0.5 : 0.23,
          };
        fly(
          target,
          view.detailZoom ? 2700 : 3300,
          view.detailZoom ? 'detail' : 'korea',
        );
      };
      updateRef.current = update;
      const onResize = () => {
        measureLayout();
        draw();
        update();
      };
      const onVisible = () => {
        if (document.hidden || !inViewport) {
          stopTwinkle();
          if (animating) {
            remaining = Math.max(1, duration - (performance.now() - started));
            cancelAnimationFrame(frame);
            animating = false;
            paused = true;
          }
        } else {
          if (paused) fly(destination, remaining, targetPhase, true);
          else {
            draw();
            startTwinkle();
          }
        }
      };
      const onReduced = () => {
        stopTwinkle();
        if (reduced.matches && (animating || paused))
          fly(destination, 1, targetPhase, true);
        else startTwinkle();
        draw();
      };
      const observer = new IntersectionObserver(([entry]) => {
        inViewport = entry.isIntersecting;
        onVisible();
      });
      releases.push(() => observer.disconnect());
      observer.observe(canvas);
      window.addEventListener('resize', onResize);
      releases.push(() => window.removeEventListener('resize', onResize));
      document.addEventListener('visibilitychange', onVisible);
      releases.push(() =>
        document.removeEventListener('visibilitychange', onVisible),
      );
      reduced.addEventListener('change', onReduced);
      releases.push(() => reduced.removeEventListener('change', onReduced));
      const geometry = Promise.all([
        fetch(sitePath('/trip/korea-10m.json'), {
          signal: controller.signal,
        }).then(
          (response) =>
            response.json() as Promise<{
              countries: Record<string, number[][][][]>;
            }>,
        ),
        fetch(sitePath('/trip/korea-lights.json'), {
          signal: controller.signal,
        }).then(
          (response) =>
            response.json() as Promise<{
              registration: { radiusScaleDegrees: number };
              clusters: {
                longitude: number;
                latitude: number;
                radiusDegrees: number;
                clusterIndex: number;
              }[];
              lights: {
                longitude: number;
                latitude: number;
                clusterIndex: number;
                brightness: number;
                size: number;
              }[];
            }>,
        ),
        fetch(sitePath('/trip/seoul-geography.json'), {
          signal: controller.signal,
        })
          .then((response) => {
            if (!response.ok) throw new Error('Unable to load Seoul geography');
            return response.json() as Promise<SeoulGeography>;
          })
          .catch(() => null),
        fetch(sitePath('/trip/seoul-lights.json'), {
          signal: controller.signal,
        })
          .then((response) => {
            if (!response.ok) throw new Error('Unable to load Seoul lights');
            return response.json() as Promise<{
              lights: {
                longitude: number;
                latitude: number;
                brightness: number;
                size: number;
              }[];
            }>;
          })
          .catch(() => null),
        fetch(sitePath('/trip/korea-regions.json'), {
          signal: controller.signal,
        })
          .then((response) => {
            if (!response.ok)
              throw new Error('Unable to load regional boundaries');
            return response.json() as Promise<RegionalGeography>;
          })
          .catch(() => null),
      ]).then(([map, points, seoul, seoulLights, regions]) => {
        if (disposed) return;
        if (seoulLights) {
          gl.bindBuffer(gl.ARRAY_BUFFER, seoulLightBuffer);
          gl.bufferData(
            gl.ARRAY_BUFFER,
            new Float32Array(
              seoulLights.lights.flatMap((point) => [
                point.longitude,
                point.latitude,
                point.brightness,
                point.size,
              ]),
            ),
            gl.STATIC_DRAW,
          );
          seoulLightCount = seoulLights.lights.length;
        }
        canvas.dataset.seoulLightCount = String(seoulLightCount);
        const edges: number[] = [];
        const appendEdges = (polygons: number[][][][]) => {
          for (const polygon of polygons)
            for (const ring of polygon)
              for (let i = 1; i < ring.length; i += 1)
                edges.push(...ring[i - 1].slice(0, 2), ...ring[i].slice(0, 2));
        };
        for (const [name, polygons] of Object.entries(map.countries))
          if (name.includes('Korea')) appendEdges(polygons);
        koreaCoastCount = edges.length / 2;
        for (const [name, polygons] of Object.entries(map.countries))
          if (!name.includes('Korea')) appendEdges(polygons);
        gl.bindBuffer(gl.ARRAY_BUFFER, coastBuffer);
        gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(edges), gl.STATIC_DRAW);
        coastCount = edges.length / 2;
        const segments = (rings: number[][][]) =>
          rings.flatMap((ring) =>
            ring.slice(1).flatMap((point, index) => [...ring[index], ...point]),
          );
        let districtData: number[] = [];
        if (seoul) {
          const boundary = segments(seoul.boundary);
          const districts = segments(
            seoul.districts.flatMap((district) => district.lines),
          );
          districtData = districts;
          const river: number[] = [];
          for (const ring of [...seoul.river, ...seoul.riverHoles]) {
            riverRanges.push({ start: river.length / 2, count: ring.length });
            river.push(...ring.flat());
          }
          for (const [buffer, data] of [
            [boundaryBuffer, boundary],
            [riverBuffer, river],
          ] as const) {
            gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
            gl.bufferData(
              gl.ARRAY_BUFFER,
              new Float32Array(data),
              gl.STATIC_DRAW,
            );
          }
          boundaryCount = boundary.length / 2;
          districtCount = districts.length / 2;
          localLabels = seoul.labels.filter(
            (label) => label.name !== 'Seoul Station',
          );
          setGeographyLabels(localLabels);
          canvas.dataset.localGeography = 'ready';
          canvas.dataset.geographyVertices = String(
            (boundary.length + districts.length + river.length) / 2,
          );
        } else canvas.dataset.localGeography = 'unavailable';
        if (regions) {
          const provinces = segments(regions.provinces);
          provinceRange = {
            start: districtData.length / 2,
            count: provinces.length / 2,
          };
          districtData.push(...provinces);
          for (const group of regions.cityGroups) {
            const cities = segments(group.lines);
            cityRanges.push({
              start: districtData.length / 2,
              count: cities.length / 2,
              bounds: group.bounds,
            });
            districtData.push(...cities);
          }
          canvas.dataset.regionProvinces = String(regions.provinceCount);
          canvas.dataset.regionCities = String(regions.cityCount);
        }
        gl.bindBuffer(gl.ARRAY_BUFFER, districtBuffer);
        gl.bufferData(
          gl.ARRAY_BUFFER,
          new Float32Array(districtData),
          gl.STATIC_DRAW,
        );
        canvas.dataset.regionVertices = String(
          districtData.length / 2 - districtCount,
        );
        const positions: number[] = [];
        const addSprite = (
          point: { longitude: number; latitude: number; clusterIndex: number },
          radius: number,
          opacity: number,
          kind: number,
        ) => {
          for (const [x, y] of [
            [-1, -1],
            [1, -1],
            [1, 1],
            [-1, -1],
            [1, 1],
            [-1, 1],
          ])
            positions.push(
              point.longitude,
              point.latitude,
              x,
              y,
              (radius * Math.PI) / 180,
              opacity,
              kind,
              point.clusterIndex,
            );
        };
        for (const point of points.clusters)
          addSprite(point, point.radiusDegrees, 18 / 255, 0);
        gl.bindBuffer(gl.ARRAY_BUFFER, haloBuffer);
        gl.bufferData(
          gl.ARRAY_BUFFER,
          new Float32Array(positions),
          gl.STATIC_DRAW,
        );
        gl.bindBuffer(gl.ARRAY_BUFFER, lightBuffer);
        gl.bufferData(
          gl.ARRAY_BUFFER,
          new Float32Array(
            points.lights.flatMap((point) => [
              point.longitude,
              point.latitude,
              point.brightness,
              point.size,
            ]),
          ),
          gl.STATIC_DRAW,
        );
        lightCount = points.lights.length;
        clusterVertexCount = positions.length / 8;
        canvas.dataset.lightCount = String(lightCount);
        canvas.dataset.clusterCount = String(points.clusters.length);
      });
      void Promise.all([
        loadTexture('/trip/earth-color-2k.jpg', 0),
        loadTexture('/trip/earth-night-2k.jpg', 1),
        loadTexture('/trip/earth-clouds-2k.jpg', 2),
        loadTexture('/trip/night/korea-mask.png', 3),
        geometry,
      ])
        .then(() => {
          if (disposed) return;
          clearTimeout(startupTimer);
          startupTimer = undefined;
          ready = true;
          canvas.dataset.renderer = 'ready';
          canvas.dataset.phase = 'orbit';
          canvas.dataset.animating = 'false';
          canvas.dataset.textureCount = String(textures.length);
          canvas.dataset.bufferCount = String(buffers.length);
          canvas.dataset.programCount = String(programs.length);
          canvas.dataset.shaderCount = String(shaders.length);
          canvas.dataset.stencil = String(stencilEnabled);
          canvas.dataset.estimatedTextureBytes = String(
            sizes.reduce((sum, size) => sum + size, 0),
          );
          update();
          draw();
          startTwinkle();
          if (disposed) return;
          if (viewRef.current.intro && !reduced.matches)
            introTimer = setTimeout(() => {
              automaticFlight = true;
              fly(
                cameraForKorea(
                  layout.width,
                  layout.height,
                  Math.min(devicePixelRatio, 2),
                ),
                5600,
                'korea',
              );
            }, 2400);
        })
        .catch(() => fail('assets'));
      return release;
    } catch {
      fail('initialization');
      return release;
    }
  }, []);

  useEffect(() => {
    viewRef.current = {
      activityId,
      locationName,
      longitude,
      latitude,
      intro,
      detailZoom,
      mapRoute,
      origin,
      onBrowseReady,
    };
    measureRef.current?.();
    if (updateRef.current) updateRef.current();
    else if (
      !detailZoom &&
      canvasRef.current?.dataset.renderer === 'unavailable'
    )
      onBrowseReady?.();
  }, [
    activityId,
    locationName,
    longitude,
    latitude,
    intro,
    detailZoom,
    mapRoute,
    origin,
    geographyLabels,
    onBrowseReady,
  ]);

  return (
    <>
      <canvas
        ref={canvasRef}
        className="planet-canvas"
        data-scene="continuous-earth"
        aria-hidden="true"
      />
      <span
        ref={seoulLabel}
        className="map-place-label"
        data-marker="origin"
        aria-hidden="true"
      >
        <small>Departure</small>
        <b>{origin.name}</b>
      </span>
      <span
        ref={destinationLabel}
        className="map-place-label"
        data-marker="destination"
        aria-hidden="true"
        title={locationName}
      >
        <small>Destination</small>
        <b>{locationName}</b>
      </span>
      {geographyLabels.map((label) => (
        <span
          key={label.name}
          ref={(element) => {
            if (element) contextLabels.current.set(label.name, element);
            else contextLabels.current.delete(label.name);
          }}
          className="map-context-label"
          aria-hidden="true"
        >
          {label.name}
        </span>
      ))}
    </>
  );
}
