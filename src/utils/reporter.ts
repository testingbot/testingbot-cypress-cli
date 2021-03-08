import request from 'request';
import os from 'os';
import { IConfig } from './config';
import JUnitFormatter from './formatters/junit';
import fs from 'fs';
const fsPromises = fs.promises;

export enum IFormatType {
	JSON = 'json',
	JUNIT = 'junit',
}

interface IReport {
	success: boolean;
	report: any;
}

export interface IReportOptions {
	mochaFile?: string;
	toConsole?: boolean;
}

export default class Reporter {
	private config: IConfig;
	private projectId: number;
	private reportOptions: IReportOptions;

	constructor(
		config: IConfig,
		projectId: number,
		reportOptions: string | undefined,
	) {
		this.config = config;
		this.projectId = projectId;
		this.reportOptions = this.parseOptions(reportOptions);
	}

	private parseOptions(reportOptions: string | undefined): IReportOptions {
		if (!reportOptions) {
			return {} as IReportOptions;
		}

		const parsedOptions: IReportOptions = {};

		const splitArguments = reportOptions.split(',');
		for (let i = 0; i < splitArguments.length; i++) {
			const argumentData = splitArguments[i].split('=');
			if (argumentData.length < 2) {
				continue;
			}
			const key = argumentData[0];
			const value = argumentData[1];

			switch (key) {
				case 'mochaFile':
					parsedOptions['mochaFile'] = value;
					break;
				case 'toConsole':
					parsedOptions['toConsole'] = value === 'true';
					break;
			}
		}

		return parsedOptions;
	}

	public async format(formatType: IFormatType): Promise<any> {
		const reportData = await this.getReport();

		if (formatType === IFormatType.JUNIT) {
			const junitFormatter = new JUnitFormatter(reportData, this.reportOptions);
			return junitFormatter.format();
		}

		// default: save as json
		let outputFileName = 'results.json';
		if (this.reportOptions && this.reportOptions.mochaFile) {
			outputFileName = this.reportOptions.mochaFile;
		}

		await fsPromises.writeFile(outputFileName, reportData.report);
	}

	public async getReport(): Promise<IReport> {
		return new Promise((resolve, reject) => {
			const requestOptions = {
				method: 'GET',
				uri: `https://api.testingbot.com/v1/cypress/${this.projectId}/report`,
				auth: {
					user: this.config.auth.key,
					pass: this.config.auth.secret,
					sendImmediately: true,
				},
				headers: {
					'User-Agent': `TB-Cypress-CLI (${os.arch()}/${os.platform()}/${os.release()})`,
				},
			};

			request(requestOptions, function (error, response) {
				if (error) {
					return reject(error);
				}
				let responseBody: IReport = { success: false, report: {} };
				if (response) {
					if (response.body && typeof response.body === 'string') {
						response.body = JSON.parse(response.body) as IReport;
					}
					if (response.statusCode.toString().substring(0, 1) === '2') {
						responseBody = response.body;
					} else {
						return reject(response.body);
					}
				}

				resolve(responseBody);
			});
		});
	}
}
