const { BaseDetector } = require('../../src/core/detector.interface');

class ExampleDetector extends BaseDetector {
  constructor(config) {
    super({
      id: 'example-detector',
      name: 'Example Detector',
      description: 'Example detector for plugin architecture',
      enabled: true,
      parameters: {
        threshold: 1000,
        monitoredEvents: ['transfer', 'contract_invocation'],
        alertCooldown: 300000,
        ...config?.parameters
      },
      ...config
    });
    
    this.lastAlertTime = new Map();
  }

  async detect(event) {
    try {
      if (!this.shouldMonitorEvent(event)) {
        return null;
      }

      if (this.isInCooldown(event.contractId)) {
        return null;
      }

      if (this.detectSuspiciousActivity(event)) {
        this.updateLastAlertTime(event.contractId);
        
        return {
          isMatch: true,
          severity: this.calculateSeverity(event),
          title: 'Example Activity Detected',
          description: this.generateDescription(event),
          metadata: {
            detectorVersion: this.getVersion(),
            threshold: this.config.parameters.threshold,
            eventType: event.eventType,
            contractId: event.contractId,
            transactionId: event.transactionId,
            timestamp: event.timestamp
          }
        };
      }

      return null;
    } catch (error) {
      console.error(`Error in example detector: ${error.message}`);
      return null;
    }
  }

  shouldMonitorEvent(event) {
    return this.config.parameters.monitoredEvents.includes(event.eventType);
  }

  isInCooldown(contractId) {
    const lastAlert = this.lastAlertTime.get(contractId);
    if (!lastAlert) return false;
    
    const cooldownPeriod = this.config.parameters.alertCooldown;
    return (Date.now() - lastAlert) < cooldownPeriod;
  }

  updateLastAlertTime(contractId) {
    this.lastAlertTime.set(contractId, Date.now());
  }

  detectSuspiciousActivity(event) {
    if (event.eventData && event.eventData.amount) {
      const amount = parseFloat(event.eventData.amount);
      return amount > this.config.parameters.threshold;
    }

    if (event.eventType === 'contract_invocation' && event.eventData.function) {
      const suspiciousFunctions = ['drain', 'exploit', 'backdoor'];
      return suspiciousFunctions.some(func => 
        event.eventData.function.toLowerCase().includes(func)
      );
    }

    return false;
  }

  calculateSeverity(event) {
    if (event.eventData && event.eventData.amount) {
      const amount = parseFloat(event.eventData.amount);
      const threshold = this.config.parameters.threshold;
      
      if (amount > threshold * 10) return 'CRITICAL';
      if (amount > threshold * 5) return 'HIGH';
      if (amount > threshold * 2) return 'MEDIUM';
      return 'LOW';
    }

    return 'MEDIUM';
  }

  generateDescription(event) {
    if (event.eventData && event.eventData.amount) {
      const amount = parseFloat(event.eventData.amount);
      return `Large transaction: ${amount} in contract ${event.contractId}`;
    }

    if (event.eventType === 'contract_invocation') {
      return `Suspicious function called: ${event.eventData.function} in ${event.contractId}`;
    }

    return `Suspicious activity in contract ${event.contractId}`;
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

module.exports = ExampleDetector;