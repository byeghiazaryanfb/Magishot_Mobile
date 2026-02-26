import React, {
  forwardRef,
  useImperativeHandle,
  useState,
  useRef,
  useMemo,
  useEffect,
} from 'react';
import {View, StyleSheet} from 'react-native';
import {
  Canvas,
  Path,
  Rect,
  Skia,
  SkPath,
  Group,
  Image as SkiaImage,
  Line as SkiaLine,
  RoundedRect,
} from '@shopify/react-native-skia';
import {Gesture, GestureDetector} from 'react-native-gesture-handler';
import Animated from 'react-native-reanimated';
import ViewShot from 'react-native-view-shot';
import RNFS from 'react-native-fs';

interface Point {
  x: number;
  y: number;
}

interface StrokePath {
  points: Point[];
  strokeWidth: number;
}

export interface MaskDrawingCanvasRef {
  captureMask: () => Promise<string | null>;
  captureHighlighted: () => Promise<string | null>;
  hasStrokes: () => boolean;
  clearAll: () => void;
  undo: () => void;
}

interface MaskDrawingCanvasProps {
  canvasWidth: number;
  canvasHeight: number;
  brushSize: number;
  onDrawChange: (hasDrawn: boolean) => void;
  /** URI of the source image — used to render image+strokes composite for capture */
  imageUri?: string;
}

// Zoom preview constants
const PREVIEW_W = 120;
const PREVIEW_H = 120;
const PREVIEW_RADIUS = 12;
const PREVIEW_ZOOM = 1.8;
const PREVIEW_MARGIN = 8; // margin from canvas edge

/** Build an SkPath from an array of points */
const buildSkPath = (points: Point[]): SkPath | null => {
  if (points.length === 0) {
    return null;
  }
  const path = Skia.Path.Make();
  path.moveTo(points[0].x, points[0].y);
  for (let i = 1; i < points.length; i++) {
    path.lineTo(points[i].x, points[i].y);
  }
  return path;
};

const MaskDrawingCanvas = forwardRef<MaskDrawingCanvasRef, MaskDrawingCanvasProps>(
  ({canvasWidth, canvasHeight, brushSize, onDrawChange, imageUri}, ref) => {
    const [completedStrokes, setCompletedStrokes] = useState<StrokePath[]>([]);
    const [currentPoints, setCurrentPoints] = useState<Point[]>([]);
    const [isDrawing, setIsDrawing] = useState(false);
    const [touchPos, setTouchPos] = useState<Point>({x: 0, y: 0});
    const currentStrokeWidth = useRef<number>(brushSize);
    const maskShotRef = useRef<ViewShot>(null);

    // Load image for zoom preview (handles file:// and https:// URIs)
    const [loupeImage, setLoupeImage] = useState<ReturnType<typeof Skia.Image.MakeImageFromEncoded>>(null);
    useEffect(() => {
      if (!imageUri) {
        setLoupeImage(null);
        return;
      }
      let cancelled = false;
      (async () => {
        try {
          let imgBase64: string;
          if (imageUri.startsWith('http://') || imageUri.startsWith('https://')) {
            const tmp = `${RNFS.TemporaryDirectoryPath}/loupe_${Date.now()}.png`;
            const dl = await RNFS.downloadFile({fromUrl: imageUri, toFile: tmp}).promise;
            if (dl.statusCode !== 200 || cancelled) return;
            imgBase64 = await RNFS.readFile(tmp, 'base64');
            RNFS.unlink(tmp).catch(() => {});
          } else {
            const filePath = imageUri.startsWith('file://') ? imageUri.slice(7) : imageUri;
            imgBase64 = await RNFS.readFile(filePath, 'base64');
          }
          if (cancelled) return;
          const data = Skia.Data.fromBase64(imgBase64);
          if (!data) return;
          const img = Skia.Image.MakeImageFromEncoded(data);
          if (img && !cancelled) setLoupeImage(img);
        } catch (e) {
          console.warn('Zoom preview: failed to load image', e);
        }
      })();
      return () => { cancelled = true; };
    }, [imageUri]);

    // Clip path for rounded-rect zoom preview
    const previewClipPath = useMemo(() => {
      const p = Skia.Path.Make();
      p.addRRect(
        Skia.RRectXY(
          Skia.XYWHRect(0, 0, PREVIEW_W, PREVIEW_H),
          PREVIEW_RADIUS,
          PREVIEW_RADIUS,
        ),
      );
      return p;
    }, []);

    // Build SkPaths from point arrays at render time (safe, no mutation race)
    const completedSkPaths = useMemo(
      () =>
        completedStrokes.map(stroke => ({
          path: buildSkPath(stroke.points),
          strokeWidth: stroke.strokeWidth,
        })),
      [completedStrokes],
    );

    const currentSkPath = useMemo(() => buildSkPath(currentPoints), [currentPoints]);

    // Notify parent when stroke count changes (deferred via useEffect to avoid
    // updating parent state during child render)
    useEffect(() => {
      onDrawChange(completedStrokes.length > 0);
    }, [completedStrokes.length, onDrawChange]);

    useImperativeHandle(ref, () => ({
      captureMask: async () => {
        if (completedStrokes.length === 0) {
          return null;
        }
        try {
          const uri = await (maskShotRef.current as any)?.capture?.();
          return uri || null;
        } catch (e) {
          console.error('Failed to capture mask:', e);
          return null;
        }
      },
      captureHighlighted: async () => {
        if (completedStrokes.length === 0 || !imageUri) {
          return null;
        }
        try {
          // Read the image as base64 — handle both local files and remote URLs
          let imgBase64: string;
          if (imageUri.startsWith('http://') || imageUri.startsWith('https://')) {
            // Remote URL: download to temp file first, then read as base64
            const tmpDownload = `${RNFS.TemporaryDirectoryPath}/dl_${Date.now()}.png`;
            const dlResult = await RNFS.downloadFile({
              fromUrl: imageUri,
              toFile: tmpDownload,
            }).promise;
            if (dlResult.statusCode !== 200) {
              throw new Error(`Failed to download image: ${dlResult.statusCode}`);
            }
            imgBase64 = await RNFS.readFile(tmpDownload, 'base64');
            RNFS.unlink(tmpDownload).catch(() => {});
          } else {
            const filePath = imageUri.startsWith('file://')
              ? imageUri.slice(7)
              : imageUri;
            imgBase64 = await RNFS.readFile(filePath, 'base64');
          }

          // Decode into a Skia image
          const imgData = Skia.Data.fromBase64(imgBase64);
          if (!imgData) {
            throw new Error('Failed to read image data');
          }
          const skImage = Skia.Image.MakeImageFromEncoded(imgData);
          if (!skImage) {
            throw new Error('Failed to decode image');
          }

          // Create an offscreen Skia surface
          const surface = Skia.Surface.Make(canvasWidth, canvasHeight);
          if (!surface) {
            throw new Error('Failed to create offscreen surface');
          }
          const canvas = surface.getCanvas();

          // Draw image scaled to fit canvas (contain mode)
          const imgW = skImage.width();
          const imgH = skImage.height();
          const scale = Math.min(canvasWidth / imgW, canvasHeight / imgH);
          const scaledW = imgW * scale;
          const scaledH = imgH * scale;
          const offsetX = (canvasWidth - scaledW) / 2;
          const offsetY = (canvasHeight - scaledH) / 2;

          canvas.drawImageRect(
            skImage,
            Skia.XYWHRect(0, 0, imgW, imgH),
            Skia.XYWHRect(offsetX, offsetY, scaledW, scaledH),
            Skia.Paint(),
          );

          // Draw red strokes on top
          const strokePaint = Skia.Paint();
          strokePaint.setColor(Skia.Color('#FF0000'));
          strokePaint.setAlphaf(0.7);
          // style: 1 = Stroke, strokeCap: 1 = Round
          (strokePaint as any).setStyle(1);
          (strokePaint as any).setStrokeCap(1);

          for (const stroke of completedStrokes) {
            strokePaint.setStrokeWidth(stroke.strokeWidth);
            const path = buildSkPath(stroke.points);
            if (path) {
              canvas.drawPath(path, strokePaint);
            }
          }

          // Encode to PNG base64
          surface.flush();
          const snapshot = surface.makeImageSnapshot();
          const resultBase64 = snapshot.encodeToBase64();

          // Write to a temp file so we get a file:// URI for FormData
          const tmpPath = `${RNFS.TemporaryDirectoryPath}/highlighted_${Date.now()}.png`;
          await RNFS.writeFile(tmpPath, resultBase64, 'base64');

          return `file://${tmpPath}`;
        } catch (e) {
          console.error('Failed to capture highlighted image:', e);
          return null;
        }
      },
      hasStrokes: () => completedStrokes.length > 0,
      clearAll: () => {
        setCompletedStrokes([]);
        setCurrentPoints([]);
      },
      undo: () => {
        setCompletedStrokes(prev => prev.slice(0, -1));
      },
    }));

    // Accumulate points in a ref to batch them, flush to state periodically
    const pointsBuffer = useRef<Point[]>([]);

    const panGesture = Gesture.Pan()
      .runOnJS(true)
      .maxPointers(1)
      .minDistance(0)
      .onStart(e => {
        currentStrokeWidth.current = brushSize;
        pointsBuffer.current = [{x: e.x, y: e.y}];
        setCurrentPoints([{x: e.x, y: e.y}]);
        setIsDrawing(true);
        setTouchPos({x: e.x, y: e.y});
      })
      .onUpdate(e => {
        pointsBuffer.current.push({x: e.x, y: e.y});
        setTouchPos({x: e.x, y: e.y});
        // Flush every few points to limit re-renders while keeping it responsive
        if (pointsBuffer.current.length % 2 === 0) {
          setCurrentPoints([...pointsBuffer.current]);
        }
      })
      .onEnd(() => {
        const finalPoints = [...pointsBuffer.current];
        if (finalPoints.length > 0) {
          setCompletedStrokes(prev => [
            ...prev,
            {points: finalPoints, strokeWidth: currentStrokeWidth.current},
          ]);
        }
        pointsBuffer.current = [];
        setCurrentPoints([]);
        setIsDrawing(false);
      });

    // Red strokes JSX shared by visible canvas and highlighted capture
    const redStrokePaths = completedSkPaths.map(
      (stroke, i) =>
        stroke.path && (
          <Path
            key={`rs-${i}`}
            path={stroke.path}
            style="stroke"
            strokeWidth={stroke.strokeWidth}
            strokeCap="round"
            color="rgba(255, 0, 0, 0.7)"
          />
        ),
    );

    // Fixed position: top-right by default, flip to top-left when finger is near
    const previewOnRight = !(
      touchPos.x > canvasWidth - PREVIEW_W - PREVIEW_MARGIN * 3 &&
      touchPos.y < PREVIEW_H + PREVIEW_MARGIN * 3
    );
    const previewX = previewOnRight
      ? canvasWidth - PREVIEW_W - PREVIEW_MARGIN
      : PREVIEW_MARGIN;
    const previewY = PREVIEW_MARGIN;

    // Center of the preview rectangle (where the crosshair sits)
    const previewCx = PREVIEW_W / 2;
    const previewCy = PREVIEW_H / 2;

    return (
      <View style={{width: canvasWidth, height: canvasHeight}}>
        {/* Visible canvas — semi-transparent red strokes */}
        <GestureDetector gesture={panGesture}>
          <Animated.View style={{width: canvasWidth, height: canvasHeight}}>
            <Canvas style={StyleSheet.absoluteFill}>
              {redStrokePaths}
              {currentSkPath && (
                <Path
                  path={currentSkPath}
                  style="stroke"
                  strokeWidth={currentStrokeWidth.current}
                  strokeCap="round"
                  color="rgba(255, 0, 0, 0.7)"
                />
              )}
            </Canvas>
          </Animated.View>
        </GestureDetector>

        {/* Zoom preview — fixed top-right rectangle, visible while drawing */}
        {isDrawing && (
          <View
            style={[
              styles.previewContainer,
              {
                left: previewX,
                top: previewY,
                width: PREVIEW_W,
                height: PREVIEW_H,
                borderRadius: PREVIEW_RADIUS,
              },
            ]}>
            <Canvas style={{width: PREVIEW_W, height: PREVIEW_H}}>
              {/* Clip to rounded rect */}
              <Group clip={previewClipPath}>
                {/* Dark background */}
                <Rect x={0} y={0} width={PREVIEW_W} height={PREVIEW_H} color="#1a1a2e" />
                {/* Zoomed content centered on touch point */}
                <Group
                  transform={[
                    {scale: PREVIEW_ZOOM},
                    {translateX: previewCx / PREVIEW_ZOOM - touchPos.x},
                    {translateY: previewCy / PREVIEW_ZOOM - touchPos.y},
                  ]}>
                  {/* Source image */}
                  {loupeImage && (
                    <SkiaImage
                      image={loupeImage}
                      x={0}
                      y={0}
                      width={canvasWidth}
                      height={canvasHeight}
                      fit="contain"
                    />
                  )}
                  {/* Completed strokes */}
                  {completedSkPaths.map(
                    (stroke, i) =>
                      stroke.path && (
                        <Path
                          key={`lp-${i}`}
                          path={stroke.path}
                          style="stroke"
                          strokeWidth={stroke.strokeWidth}
                          strokeCap="round"
                          color="rgba(255, 0, 0, 0.7)"
                        />
                      ),
                  )}
                  {/* Current stroke being drawn */}
                  {currentSkPath && (
                    <Path
                      path={currentSkPath}
                      style="stroke"
                      strokeWidth={currentStrokeWidth.current}
                      strokeCap="round"
                      color="rgba(255, 0, 0, 0.7)"
                    />
                  )}
                </Group>
              </Group>
              {/* White border */}
              <RoundedRect
                x={1.5}
                y={1.5}
                width={PREVIEW_W - 3}
                height={PREVIEW_H - 3}
                r={PREVIEW_RADIUS - 1}
                style="stroke"
                strokeWidth={2}
                color="rgba(255, 255, 255, 0.9)"
              />
              {/* Crosshair lines */}
              <SkiaLine
                p1={{x: previewCx - 8, y: previewCy}}
                p2={{x: previewCx + 8, y: previewCy}}
                style="stroke"
                strokeWidth={1}
                color="rgba(255, 255, 255, 0.7)"
              />
              <SkiaLine
                p1={{x: previewCx, y: previewCy - 8}}
                p2={{x: previewCx, y: previewCy + 8}}
                style="stroke"
                strokeWidth={1}
                color="rgba(255, 255, 255, 0.7)"
              />
            </Canvas>
          </View>
        )}

        {/* Hidden mask canvas — white bg + black strokes for capture */}
        <ViewShot
          ref={maskShotRef}
          options={{format: 'png', quality: 1, result: 'tmpfile'}}
          style={[styles.hiddenCanvas, {width: canvasWidth, height: canvasHeight}]}>
          <Canvas style={{width: canvasWidth, height: canvasHeight}}>
            <Rect x={0} y={0} width={canvasWidth} height={canvasHeight} color="white" />
            {completedSkPaths.map(
              (stroke, i) =>
                stroke.path && (
                  <Path
                    key={`mask-${i}`}
                    path={stroke.path}
                    style="stroke"
                    strokeWidth={stroke.strokeWidth}
                    strokeCap="round"
                    color="black"
                  />
                ),
            )}
          </Canvas>
        </ViewShot>

      </View>
    );
  },
);

const styles = StyleSheet.create({
  hiddenCanvas: {
    position: 'absolute',
    top: 0,
    left: 0,
    opacity: 0,
    pointerEvents: 'none',
  },
  previewContainer: {
    position: 'absolute',
    pointerEvents: 'none',
    shadowColor: '#000',
    shadowOffset: {width: 0, height: 3},
    shadowOpacity: 0.5,
    shadowRadius: 6,
    elevation: 10,
    overflow: 'hidden',
  },
});

export default MaskDrawingCanvas;
