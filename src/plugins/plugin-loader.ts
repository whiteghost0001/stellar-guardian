import { BaseDetector } from '../core/detector.interface';
import { PluginManifest, DetectorConfig } from '../core/types';
import * as fs from 'fs';
import * as path from 'path';

export class PluginLoader {
  private pluginsDir: string;
  private loadedPlugins: Map<string, any> = new Map();

  constructor(pluginsDir: string = './plugins') {
    this.pluginsDir = pluginsDir;
  }

  async loadAllPlugins(): Promise<BaseDetector[]> {
    const detectors: BaseDetector[] = [];
    
    if (!fs.existsSync(this.pluginsDir)) {
      console.log(`Plugins directory ${this.pluginsDir} does not exist`);
      return detectors;
    }

    const pluginDirs = fs.readdirSync(this.pluginsDir, { withFileTypes: true })
      .filter(dirent => dirent.isDirectory())
      .map(dirent => dirent.name);

    for (const pluginDir of pluginDirs) {
      try {
        const pluginDetectors = await this.loadPlugin(pluginDir);
        detectors.push(...pluginDetectors);
      } catch (error) {
        console.error(`Failed to load plugin ${pluginDir}:`, error);
      }
    }

    return detectors;
  }

  async loadPlugin(pluginName: string): Promise<BaseDetector[]> {
    const pluginPath = path.join(this.pluginsDir, pluginName);
    const manifestPath = path.join(pluginPath, 'manifest.json');
    
    if (!fs.existsSync(manifestPath)) {
      throw new Error(`Plugin manifest not found: ${manifestPath}`);
    }

    const manifest: PluginManifest = JSON.parse(
      fs.readFileSync(manifestPath, 'utf8')
    );

    console.log(`Loading plugin: ${manifest.name} v${manifest.version}`);

    const detectors: BaseDetector[] = [];
    
    for (const detectorConfig of manifest.detectors) {
      try {
        const detector = await this.loadDetector(pluginPath, detectorConfig);
        if (detector) {
          detectors.push(detector);
          this.loadedPlugins.set(detector.getName(), {
            manifest,
            detector,
            path: pluginPath
          });
        }
      } catch (error) {
        console.error(`Failed to load detector ${detectorConfig.name}:`, error);
      }
    }

    return detectors;
  }

  private async loadDetector(pluginPath: string, config: DetectorConfig): Promise<BaseDetector | null> {
    try {
      // Look for detector file
      const detectorFile = path.join(pluginPath, `${config.id}.js`);
      
      if (!fs.existsSync(detectorFile)) {
        console.warn(`Detector file not found: ${detectorFile}`);
        return null;
      }

      // Dynamic import of the detector
      const detectorModule = await import(detectorFile);
      const DetectorClass = detectorModule.default || detectorModule[config.name];
      
      if (!DetectorClass) {
        throw new Error(`Detector class not found in ${detectorFile}`);
      }

      return new DetectorClass(config);
    } catch (error) {
      console.error(`Failed to load detector from ${pluginPath}:`, error);
      return null;
    }
  }

  getLoadedPlugins(): Map<string, any> {
    return this.loadedPlugins;
  }

  async reloadPlugin(pluginName: string): Promise<BaseDetector[]> {
    // Unload existing plugin
    this.unloadPlugin(pluginName);
    
    // Load plugin again
    return await this.loadPlugin(pluginName);
  }

  unloadPlugin(pluginName: string): void {
    const pluginInfo = this.loadedPlugins.get(pluginName);
    if (pluginInfo) {
      this.loadedPlugins.delete(pluginName);
      console.log(`Unloaded plugin: ${pluginName}`);
    }
  }

  validateManifest(manifest: PluginManifest): boolean {
    const required = ['name', 'version', 'description', 'author', 'detectors'];
    
    for (const field of required) {
      if (!manifest[field as keyof PluginManifest]) {
        console.error(`Missing required field in manifest: ${field}`);
        return false;
      }
    }

    if (!Array.isArray(manifest.detectors) || manifest.detectors.length === 0) {
      console.error('Manifest must contain at least one detector');
      return false;
    }

    return true;
  }

  async createPluginTemplate(pluginName: string, outputDir: string): Promise<void> {
    const pluginDir = path.join(outputDir, pluginName);
    
    if (!fs.existsSync(pluginDir)) {
      fs.mkdirSync(pluginDir, { recursive: true });
    }

    // Create manifest template
    const manifest: PluginManifest = {
      name: pluginName,
      version: '1.0.0',
      description: `${pluginName} detector plugin`,
      author: 'Plugin Author',
      detectors: [{
        id: `${pluginName}-detector`,
        name: `${pluginName} Detector`,
        description: `Detects ${pluginName} related activities`,
        enabled: true,
        parameters: {}
      }]
    };

    fs.writeFileSync(
      path.join(pluginDir, 'manifest.json'),
      JSON.stringify(manifest, null, 2)
    );

    // Create detector template
    const detectorTemplate = this.generateDetectorTemplate(pluginName);
    fs.writeFileSync(
      path.join(pluginDir, `${pluginName}-detector.js`),
      detectorTemplate
    );

    console.log(`Plugin template created at: ${pluginDir}`);
  }

  private generateDetectorTemplate(pluginName: string): string {
    return `const { BaseDetector } = require('../../../src/core/detector.interface');

class ${pluginName}Detector extends BaseDetector {
  constructor(config) {
    super({
      id: '${pluginName}-detector',
      name: '${pluginName} Detector',
      description: 'Detects ${pluginName} related activities',
      enabled: true,
      parameters: {
        // Add your parameters here
      },
      ...config
    });
  }

  async detect(event) {
    try {
      // Implement your detection logic here
      
      // Return null if no match
      if (!this.shouldAlert(event)) {
        return null;
      }

      // Return detection result
      return {
        isMatch: true,
        severity: 'MEDIUM',
        title: '${pluginName} Activity Detected',
        description: \`\${pluginName} activity detected in transaction \${event.transactionId}\`,
        metadata: {
          contractId: event.contractId,
          transactionId: event.transactionId,
          timestamp: event.timestamp
        }
      };
    } catch (error) {
      this.log(\`Error in ${pluginName} detector: \${error}\`, 'error');
      return null;
    }
  }

  shouldAlert(event) {
    // Implement your detection criteria here
    return false;
  }

  getName() {
    return this.config.name;
  }

  getDescription() {
    return this.config.description;
  }

  getVersion() {
    return '1.0.0';
  }
}

module.exports = ${pluginName}Detector;
`;
  }
}