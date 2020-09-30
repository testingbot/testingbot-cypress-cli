import tracer from 'tracer';

const logger = tracer.console({
	level: 'info',
	format: '{{message}}',
});

export default logger;
