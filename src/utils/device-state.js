const deviceState = {
	isActive: false,
	activeCommand: null,
	timeoutId: null,
	intervalId: null,
	queue: [],
	userCommandCounts: new Map(),
	USER_COMMAND_LIMIT: 3,
	USER_TIMEOUT: 30000,
	
	enqueue(commandData) {
		this.queue.push(commandData);
	},
	
	dequeue() {
		return this.queue.shift();
	},
	
	hasQueuedCommands() {
		return this.queue.length > 0;
	},
	
	getQueueLength() {
		return this.queue.length;
	},
	
	canUserAddCommand(userId) {
		const userCount = this.userCommandCounts.get(userId) || { count: 0, lastCommand: 0 };
		const now = Date.now();
		
		if (now - userCount.lastCommand > this.USER_TIMEOUT) {
			userCount.count = 0;
		}
		
		return userCount.count < this.USER_COMMAND_LIMIT;
	},
	
	incrementUserCommand(userId) {
		const now = Date.now();
		const userCount = this.userCommandCounts.get(userId) || { count: 0, lastCommand: 0 };
		
		if (now - userCount.lastCommand > this.USER_TIMEOUT) {
			userCount.count = 0;
		}
		
		userCount.count++;
		userCount.lastCommand = now;
		this.userCommandCounts.set(userId, userCount);
	},
	
	async processNextCommand() {
		if (!this.hasQueuedCommands() || this.isActive) {
			return;
		}
		
		const commandData = this.dequeue();
		if (commandData) {
			this.isActive = true;
			this.activeCommand = commandData.type;
			
			try {
				await commandData.execute();
			} catch (error) {
				console.error('Error executing queued command:', error);
				this.isActive = false;
				this.activeCommand = null;
				setTimeout(() => this.processNextCommand(), 100);
			}
		}
	},
	
	completeCurrentCommand() {
		this.isActive = false;
		this.activeCommand = null;
		this.timeoutId = null;
		this.intervalId = null;
		
		setTimeout(() => this.processNextCommand(), 500);
	},
	
	clearAll() {
		if (this.timeoutId) {
			clearTimeout(this.timeoutId);
		}
		if (this.intervalId) {
			clearInterval(this.intervalId);
		}
		
		this.isActive = false;
		this.activeCommand = null;
		this.timeoutId = null;
		this.intervalId = null;
		this.queue = [];
	}
};

module.exports = deviceState;
