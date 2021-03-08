import { IReportOptions } from '../reporter';
import fs from 'fs';
import { create } from 'xmlbuilder2';
const fsPromises = fs.promises;

export default class JUnitFormatter {
	private reportData: any;
	private reportOptions: IReportOptions;

	constructor(reportData: any, reportOptions: IReportOptions) {
		this.reportData = JSON.parse(reportData.report);
		this.reportOptions = reportOptions;
	}

	public async format(): Promise<any> {
		const doc = create().ele('testsuites', {
			name: 'Cypress Tests',
			tests: this.reportData.results.length,
		});

		for (let i = 0; i < this.reportData.results.length; i++) {
			for (let j = 0; j < this.reportData.results[i].suites.length; j++) {
				const suite = this.reportData.results[i].suites[j];
				const failureCount = suite.tests.filter((index: number, value: any) => {
					return value.pass === true;
				}).length;
				const suiteElement = doc.root().ele('testsuite', {
					name: suite.title,
					timestamp: new Date().toUTCString(),
					tests: suite.tests.length,
					failures: failureCount,
				});

				for (let k = 0; k < suite.tests.length; k++) {
					const testCase = suite.tests[k];
					const testElement = suiteElement.ele('testcase', {
						name: testCase.fullTitle,
						classname: testCase.fullTitle,
						time: testCase.duration / 1000,
					});

					if (testCase.err && testCase.err.message) {
						testElement.ele('failure', {
							message: testCase.err.message,
						});
					}

					if (testCase.err && testCase.err.message) {
						testElement.ele('failure', {
							message: testCase.err.message,
						});
					}
				}
			}
		}

		const xml = doc.end({ prettyPrint: true });

		let outputFileName = 'test-results.xml';
		if (this.reportOptions && this.reportOptions.mochaFile) {
			outputFileName = this.reportOptions.mochaFile;
		}

		await fsPromises.writeFile(outputFileName, xml);

		return this.reportData;
	}
}
