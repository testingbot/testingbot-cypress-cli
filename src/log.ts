import tracer from 'tracer';

const logger = tracer.colorConsole({
	level: 'info',
	format: '{{timestamp}} {{file}}:{{line}} {{title}}: {{message}}',
	dateformat: 'HH:MM:ss.L',
});

export default logger;
