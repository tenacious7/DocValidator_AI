import sharp from 'sharp';
import { spawn } from 'child_process';
import path from 'path';
import fs from 'fs/promises';
import config from '../config/config.js';
import logger from '../utils/logger.js';

export class EnhancedForgeryDetector {
  constructor() {
    logger.info('Enhanced Forgery Detection Service initialized');
  }

  async analyzeImage(imagePath) {
    try {
      logger.info(`Starting forgery analysis for: ${imagePath}`);
      
      // Parallel execution of different analysis methods
      const [
        elaAnalysis,
        compressionAnalysis,
        metadataAnalysis,
        noiseAnalysis,
        edgeAnalysis
      ] = await Promise.all([
        this.performELA(imagePath),
        this.analyzeCompression(imagePath),
        this.analyzeMetadata(imagePath),
        this.analyzeNoise(imagePath),
        this.analyzeEdges(imagePath)
      ]);

      const suspiciousAreas = await this.detectSuspiciousAreas(imagePath, elaAnalysis);
      const forgeryScore = this.calculateForgeryScore({
        elaAnalysis,
        compressionAnalysis,
        metadataAnalysis,
        noiseAnalysis,
        edgeAnalysis,
        suspiciousAreas
      });

      const result = {
        isForgery: forgeryScore > 0.6,
        forgeryScore,
        suspiciousAreas,
        elaAnalysis,
        compressionAnalysis,
        metadataAnalysis,
        noiseAnalysis,
        edgeAnalysis,
        analysis: this.generateDetailedAnalysis(forgeryScore, {
          elaAnalysis,
          compressionAnalysis,
          metadataAnalysis,
          suspiciousAreas
        })
      };

      logger.info(`Forgery analysis completed. Score: ${forgeryScore}`);
      return result;
    } catch (error) {
      logger.error('Forgery analysis failed:', error);
      throw new Error('Failed to analyze image for forgery');
    }
  }

  async performELA(imagePath) {
    try {
      const outputPath = imagePath.replace(/\.(jpg|jpeg|png)$/i, '_ela.jpg');
      
      // Load original image
      const originalBuffer = await sharp(imagePath)
        .jpeg({ quality: config.ai.forgery.elaQuality })
        .toBuffer();

      // Re-compress at same quality
      const recompressedBuffer = await sharp(originalBuffer)
        .jpeg({ quality: config.ai.forgery.elaQuality })
        .toBuffer();

      // Calculate difference (ELA)
      const elaBuffer = await this.calculateImageDifference(originalBuffer, recompressedBuffer);
      
      // Save ELA image
      await fs.writeFile(outputPath, elaBuffer);

      // Analyze ELA statistics
      const stats = await this.analyzeELAStatistics(elaBuffer);

      return {
        elaImagePath: outputPath,
        statistics: stats,
        hasAnomalies: stats.maxIntensity > 50 || stats.variance > 1000
      };
    } catch (error) {
      logger.error('ELA analysis failed:', error);
      throw new Error('Failed to perform ELA analysis');
    }
  }

  async calculateImageDifference(buffer1, buffer2) {
    // Use Python script for precise ELA calculation
    return new Promise((resolve, reject) => {
      const pythonScript = path.join(config.python.scriptPath, 'ela_analysis.py');
      const process = spawn('python3', [pythonScript]);
      
      let output = Buffer.alloc(0);
      let error = '';

      // Send image buffers to Python script
      process.stdin.write(JSON.stringify({
        image1: buffer1.toString('base64'),
        image2: buffer2.toString('base64')
      }));
      process.stdin.end();

      process.stdout.on('data', (data) => {
        output = Buffer.concat([output, data]);
      });

      process.stderr.on('data', (data) => {
        error += data.toString();
      });

      process.on('close', (code) => {
        if (code === 0) {
          resolve(output);
        } else {
          reject(new Error(`ELA calculation failed: ${error}`));
        }
      });
    });
  }

  async analyzeELAStatistics(elaBuffer) {
    const { data, info } = await sharp(elaBuffer)
      .raw()
      .toBuffer({ resolveWithObject: true });

    const pixels = new Uint8Array(data);
    let sum = 0;
    let max = 0;
    let min = 255;

    for (let i = 0; i < pixels.length; i++) {
      const value = pixels[i];
      sum += value;
      max = Math.max(max, value);
      min = Math.min(min, value);
    }

    const mean = sum / pixels.length;
    let variance = 0;

    for (let i = 0; i < pixels.length; i++) {
      variance += Math.pow(pixels[i] - mean, 2);
    }
    variance /= pixels.length;

    return {
      mean,
      variance,
      maxIntensity: max,
      minIntensity: min,
      standardDeviation: Math.sqrt(variance)
    };
  }

  async analyzeCompression(imagePath) {
    try {
      const metadata = await sharp(imagePath).metadata();
      
      // Analyze JPEG compression artifacts
      const compressionArtifacts = await this.detectCompressionArtifacts(imagePath);
      
      // Check for inconsistent compression levels
      const compressionMap = await this.generateCompressionMap(imagePath);

      return {
        format: metadata.format,
        quality: metadata.quality || 'unknown',
        hasInconsistentCompression: compressionArtifacts.inconsistentBlocks > 5,
        compressionArtifacts,
        compressionMap,
        analysis: this.analyzeCompressionPatterns(compressionArtifacts, compressionMap)
      };
    } catch (error) {
      logger.error('Compression analysis failed:', error);
      return {
        hasInconsistentCompression: false,
        error: error.message
      };
    }
  }

  async detectCompressionArtifacts(imagePath) {
    // Use Python script for detailed compression analysis
    return new Promise((resolve, reject) => {
      const pythonScript = path.join(config.python.scriptPath, 'compression_analysis.py');
      const process = spawn('python3', [pythonScript, imagePath]);
      
      let output = '';
      let error = '';

      process.stdout.on('data', (data) => {
        output += data.toString();
      });

      process.stderr.on('data', (data) => {
        error += data.toString();
      });

      process.on('close', (code) => {
        if (code === 0) {
          try {
            resolve(JSON.parse(output));
          } catch (parseError) {
            resolve({ inconsistentBlocks: 0, artifacts: [] });
          }
        } else {
          resolve({ inconsistentBlocks: 0, artifacts: [], error });
        }
      });
    });
  }

  async generateCompressionMap(imagePath) {
    // Generate a map showing compression quality across the image
    const { data, info } = await sharp(imagePath)
      .resize(100, 100) // Downsample for analysis
      .raw()
      .toBuffer({ resolveWithObject: true });

    const blockSize = 8;
    const compressionMap = [];

    for (let y = 0; y < info.height; y += blockSize) {
      for (let x = 0; x < info.width; x += blockSize) {
        const blockQuality = this.estimateBlockQuality(data, x, y, blockSize, info.width, info.channels);
        compressionMap.push({
          x, y, width: blockSize, height: blockSize, quality: blockQuality
        });
      }
    }

    return compressionMap;
  }

  estimateBlockQuality(data, startX, startY, blockSize, imageWidth, channels) {
    let variance = 0;
    let count = 0;

    for (let y = startY; y < startY + blockSize; y++) {
      for (let x = startX; x < startX + blockSize; x++) {
        if (x < imageWidth && y * imageWidth + x < data.length / channels) {
          const pixelIndex = (y * imageWidth + x) * channels;
          const intensity = (data[pixelIndex] + data[pixelIndex + 1] + data[pixelIndex + 2]) / 3;
          variance += intensity;
          count++;
        }
      }
    }

    return count > 0 ? variance / count : 0;
  }

  analyzeCompressionPatterns(artifacts, compressionMap) {
    const qualityVariance = this.calculateQualityVariance(compressionMap);
    const suspiciousBlocks = compressionMap.filter(block => 
      Math.abs(block.quality - qualityVariance.mean) > qualityVariance.stdDev * 2
    );

    return {
      qualityVariance,
      suspiciousBlockCount: suspiciousBlocks.length,
      suspiciousBlocks: suspiciousBlocks.slice(0, 10), // Limit to top 10
      overallSuspicion: suspiciousBlocks.length > 5 ? 'high' : 
                       suspiciousBlocks.length > 2 ? 'medium' : 'low'
    };
  }

  calculateQualityVariance(compressionMap) {
    const qualities = compressionMap.map(block => block.quality);
    const mean = qualities.reduce((sum, q) => sum + q, 0) / qualities.length;
    const variance = qualities.reduce((sum, q) => sum + Math.pow(q - mean, 2), 0) / qualities.length;
    
    return {
      mean,
      variance,
      stdDev: Math.sqrt(variance)
    };
  }

  async analyzeMetadata(imagePath) {
    try {
      const metadata = await sharp(imagePath).metadata();
      
      // Extract EXIF data if available
      const exifData = metadata.exif ? this.parseExifData(metadata.exif) : {};
      
      return {
        format: metadata.format,
        width: metadata.width,
        height: metadata.height,
        density: metadata.density,
        hasProfile: !!metadata.icc,
        exif: exifData,
        hasInconsistentMetadata: this.checkMetadataConsistency(metadata, exifData),
        creationDate: exifData.DateTime || new Date(),
        modificationDate: exifData.ModifyDate || new Date(),
        software: exifData.Software || 'Unknown',
        camera: exifData.Make && exifData.Model ? `${exifData.Make} ${exifData.Model}` : 'Unknown'
      };
    } catch (error) {
      logger.error('Metadata analysis failed:', error);
      return {
        hasInconsistentMetadata: false,
        error: error.message
      };
    }
  }

  parseExifData(exifBuffer) {
    // Basic EXIF parsing - in production, use a proper EXIF library
    try {
      const exifString = exifBuffer.toString('ascii');
      const exifData = {};
      
      // Extract common EXIF fields using regex
      const patterns = {
        DateTime: /DateTime\x00([^\x00]+)/,
        Software: /Software\x00([^\x00]+)/,
        Make: /Make\x00([^\x00]+)/,
        Model: /Model\x00([^\x00]+)/
      };

      Object.entries(patterns).forEach(([key, pattern]) => {
        const match = exifString.match(pattern);
        if (match) {
          exifData[key] = match[1].trim();
        }
      });

      return exifData;
    } catch (error) {
      return {};
    }
  }

  checkMetadataConsistency(metadata, exifData) {
    // Check for common metadata inconsistencies
    const inconsistencies = [];

    // Check if creation date is in the future
    if (exifData.DateTime) {
      const creationDate = new Date(exifData.DateTime);
      if (creationDate > new Date()) {
        inconsistencies.push('Creation date is in the future');
      }
    }

    // Check for suspicious software signatures
    const suspiciousSoftware = ['photoshop', 'gimp', 'paint.net'];
    if (exifData.Software && suspiciousSoftware.some(sw => 
      exifData.Software.toLowerCase().includes(sw))) {
      inconsistencies.push('Image edited with photo manipulation software');
    }

    return inconsistencies.length > 0;
  }

  async analyzeNoise(imagePath) {
    try {
      // Analyze noise patterns that might indicate tampering
      const { data, info } = await sharp(imagePath)
        .greyscale()
        .raw()
        .toBuffer({ resolveWithObject: true });

      const noiseMetrics = this.calculateNoiseMetrics(data, info);
      const noiseMap = this.generateNoiseMap(data, info);

      return {
        metrics: noiseMetrics,
        noiseMap,
        hasInconsistentNoise: noiseMetrics.variance > 1000,
        analysis: this.analyzeNoisePatterns(noiseMetrics, noiseMap)
      };
    } catch (error) {
      logger.error('Noise analysis failed:', error);
      return { hasInconsistentNoise: false, error: error.message };
    }
  }

  calculateNoiseMetrics(data, info) {
    const pixels = new Uint8Array(data);
    let sum = 0;
    let sumSquares = 0;

    for (let i = 0; i < pixels.length; i++) {
      sum += pixels[i];
      sumSquares += pixels[i] * pixels[i];
    }

    const mean = sum / pixels.length;
    const variance = (sumSquares / pixels.length) - (mean * mean);

    return {
      mean,
      variance,
      standardDeviation: Math.sqrt(variance),
      snr: mean / Math.sqrt(variance)
    };
  }

  generateNoiseMap(data, info) {
    const blockSize = 16;
    const noiseMap = [];

    for (let y = 0; y < info.height; y += blockSize) {
      for (let x = 0; x < info.width; x += blockSize) {
        const blockNoise = this.calculateBlockNoise(data, x, y, blockSize, info.width);
        noiseMap.push({
          x, y, width: blockSize, height: blockSize, noise: blockNoise
        });
      }
    }

    return noiseMap;
  }

  calculateBlockNoise(data, startX, startY, blockSize, imageWidth) {
    let variance = 0;
    let count = 0;
    let mean = 0;

    // First pass: calculate mean
    for (let y = startY; y < startY + blockSize; y++) {
      for (let x = startX; x < startX + blockSize; x++) {
        if (x < imageWidth && y * imageWidth + x < data.length) {
          mean += data[y * imageWidth + x];
          count++;
        }
      }
    }
    mean /= count;

    // Second pass: calculate variance
    for (let y = startY; y < startY + blockSize; y++) {
      for (let x = startX; x < startX + blockSize; x++) {
        if (x < imageWidth && y * imageWidth + x < data.length) {
          variance += Math.pow(data[y * imageWidth + x] - mean, 2);
        }
      }
    }

    return count > 0 ? variance / count : 0;
  }

  analyzeNoisePatterns(metrics, noiseMap) {
    const noiseValues = noiseMap.map(block => block.noise);
    const noiseMean = noiseValues.reduce((sum, n) => sum + n, 0) / noiseValues.length;
    const noiseVariance = noiseValues.reduce((sum, n) => sum + Math.pow(n - noiseMean, 2), 0) / noiseValues.length;

    const suspiciousBlocks = noiseMap.filter(block => 
      Math.abs(block.noise - noiseMean) > Math.sqrt(noiseVariance) * 2
    );

    return {
      noiseMean,
      noiseVariance,
      suspiciousBlockCount: suspiciousBlocks.length,
      suspiciousBlocks: suspiciousBlocks.slice(0, 10),
      overallSuspicion: suspiciousBlocks.length > 10 ? 'high' : 
                       suspiciousBlocks.length > 5 ? 'medium' : 'low'
    };
  }

  async analyzeEdges(imagePath) {
    try {
      // Detect edge inconsistencies that might indicate splicing
      const edgeData = await sharp(imagePath)
        .greyscale()
        .convolve({
          width: 3,
          height: 3,
          kernel: [-1, -1, -1, -1, 8, -1, -1, -1, -1] // Edge detection kernel
        })
        .raw()
        .toBuffer();

      const edgeMetrics = this.analyzeEdgeConsistency(edgeData);

      return {
        metrics: edgeMetrics,
        hasInconsistentEdges: edgeMetrics.inconsistencyScore > 0.3
      };
    } catch (error) {
      logger.error('Edge analysis failed:', error);
      return { hasInconsistentEdges: false, error: error.message };
    }
  }

  analyzeEdgeConsistency(edgeData) {
    const pixels = new Uint8Array(edgeData);
    let edgePixels = 0;
    let totalIntensity = 0;

    for (let i = 0; i < pixels.length; i++) {
      if (pixels[i] > 50) { // Edge threshold
        edgePixels++;
        totalIntensity += pixels[i];
      }
    }

    const edgeRatio = edgePixels / pixels.length;
    const averageEdgeIntensity = edgePixels > 0 ? totalIntensity / edgePixels : 0;

    return {
      edgeRatio,
      averageEdgeIntensity,
      inconsistencyScore: Math.abs(edgeRatio - 0.1) // Expected edge ratio around 10%
    };
  }

  async detectSuspiciousAreas(imagePath, elaAnalysis) {
    try {
      if (!elaAnalysis.elaImagePath) {
        return [];
      }

      // Analyze ELA image to find suspicious regions
      const { data, info } = await sharp(elaAnalysis.elaImagePath)
        .greyscale()
        .raw()
        .toBuffer({ resolveWithObject: true });

      const suspiciousAreas = [];
      const blockSize = 32;

      for (let y = 0; y < info.height; y += blockSize) {
        for (let x = 0; x < info.width; x += blockSize) {
          const blockIntensity = this.calculateBlockIntensity(data, x, y, blockSize, info.width);
          
          if (blockIntensity > config.ai.forgery.suspiciousAreaThreshold * 255) {
            suspiciousAreas.push({
              x,
              y,
              width: Math.min(blockSize, info.width - x),
              height: Math.min(blockSize, info.height - y),
              confidence: Math.min(blockIntensity / 255, 1),
              type: this.classifySuspiciousArea(blockIntensity),
              intensity: blockIntensity
            });
          }
        }
      }

      // Merge nearby suspicious areas
      return this.mergeSuspiciousAreas(suspiciousAreas);
    } catch (error) {
      logger.error('Suspicious area detection failed:', error);
      return [];
    }
  }

  calculateBlockIntensity(data, startX, startY, blockSize, imageWidth) {
    let totalIntensity = 0;
    let count = 0;

    for (let y = startY; y < startY + blockSize; y++) {
      for (let x = startX; x < startX + blockSize; x++) {
        if (x < imageWidth && y * imageWidth + x < data.length) {
          totalIntensity += data[y * imageWidth + x];
          count++;
        }
      }
    }

    return count > 0 ? totalIntensity / count : 0;
  }

  classifySuspiciousArea(intensity) {
    if (intensity > 200) return 'high_manipulation';
    if (intensity > 150) return 'medium_manipulation';
    if (intensity > 100) return 'low_manipulation';
    return 'noise';
  }

  mergeSuspiciousAreas(areas) {
    // Simple area merging - combine overlapping or nearby areas
    const merged = [];
    const processed = new Set();

    for (let i = 0; i < areas.length; i++) {
      if (processed.has(i)) continue;

      const area = areas[i];
      const group = [area];
      processed.add(i);

      // Find nearby areas to merge
      for (let j = i + 1; j < areas.length; j++) {
        if (processed.has(j)) continue;

        const other = areas[j];
        if (this.areAreasNearby(area, other, 50)) {
          group.push(other);
          processed.add(j);
        }
      }

      // Merge the group into a single area
      if (group.length > 1) {
        merged.push(this.mergeAreaGroup(group));
      } else {
        merged.push(area);
      }
    }

    return merged.slice(0, 20); // Limit to top 20 suspicious areas
  }

  areAreasNearby(area1, area2, threshold) {
    const centerX1 = area1.x + area1.width / 2;
    const centerY1 = area1.y + area1.height / 2;
    const centerX2 = area2.x + area2.width / 2;
    const centerY2 = area2.y + area2.height / 2;

    const distance = Math.sqrt(
      Math.pow(centerX2 - centerX1, 2) + Math.pow(centerY2 - centerY1, 2)
    );

    return distance < threshold;
  }

  mergeAreaGroup(group) {
    const minX = Math.min(...group.map(a => a.x));
    const minY = Math.min(...group.map(a => a.y));
    const maxX = Math.max(...group.map(a => a.x + a.width));
    const maxY = Math.max(...group.map(a => a.y + a.height));

    const avgConfidence = group.reduce((sum, a) => sum + a.confidence, 0) / group.length;
    const avgIntensity = group.reduce((sum, a) => sum + a.intensity, 0) / group.length;

    return {
      x: minX,
      y: minY,
      width: maxX - minX,
      height: maxY - minY,
      confidence: avgConfidence,
      type: this.classifySuspiciousArea(avgIntensity),
      intensity: avgIntensity,
      mergedCount: group.length
    };
  }

  calculateForgeryScore(analyses) {
    let score = 0;
    const weights = {
      ela: 0.25,
      compression: 0.20,
      metadata: 0.15,
      noise: 0.20,
      edges: 0.10,
      suspiciousAreas: 0.10
    };

    // ELA Analysis Score
    if (analyses.elaAnalysis.hasAnomalies) {
      score += weights.ela * 0.8;
    }

    // Compression Analysis Score
    if (analyses.compressionAnalysis.hasInconsistentCompression) {
      score += weights.compression * 0.7;
    }

    // Metadata Analysis Score
    if (analyses.metadataAnalysis.hasInconsistentMetadata) {
      score += weights.metadata * 0.6;
    }

    // Noise Analysis Score
    if (analyses.noiseAnalysis.hasInconsistentNoise) {
      score += weights.noise * 0.5;
    }

    // Edge Analysis Score
    if (analyses.edgeAnalysis.hasInconsistentEdges) {
      score += weights.edges * 0.4;
    }

    // Suspicious Areas Score
    const suspiciousAreaScore = Math.min(analyses.suspiciousAreas.length / 10, 1);
    score += weights.suspiciousAreas * suspiciousAreaScore;

    return Math.min(score, 1);
  }

  generateDetailedAnalysis(forgeryScore, analyses) {
    const findings = [];

    if (analyses.elaAnalysis.hasAnomalies) {
      findings.push('Error Level Analysis detected potential tampering areas');
    }

    if (analyses.compressionAnalysis.hasInconsistentCompression) {
      findings.push('Inconsistent JPEG compression patterns found');
    }

    if (analyses.metadataAnalysis.hasInconsistentMetadata) {
      findings.push('Metadata inconsistencies detected');
    }

    if (analyses.suspiciousAreas.length > 5) {
      findings.push(`${analyses.suspiciousAreas.length} suspicious regions identified`);
    }

    if (forgeryScore > 0.8) {
      return `HIGH RISK: Multiple forgery indicators detected. ${findings.join('. ')}.`;
    } else if (forgeryScore > 0.6) {
      return `MEDIUM RISK: Some forgery indicators present. ${findings.join('. ')}.`;
    } else if (forgeryScore > 0.3) {
      return `LOW RISK: Minor inconsistencies found. ${findings.join('. ')}.`;
    } else {
      return 'Document appears authentic with no significant tampering indicators.';
    }
  }
}