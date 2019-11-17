// Type definitions for express-oas-generator 1.0.17
// Project: https://github.com/mpashkovskiy/express-oas-generator
// Definitions by: Kipras Melnikovas <https://github.com/sarpik>

/**
 * Make sure to check out
 * https://www.typescriptlang.org/docs/handbook/declaration-files/publishing.html
 */

import { Express } from 'express';
import { OpenAPIV2 } from 'openapi-types';

/** re-export for ease of use for the end user */
export {
	OpenAPIV2, //
};

export interface HandleResponsesOptions {
	/** from where there generated documentation will be available */
	swaggerUiServePath?: string;

	/**
	 * where to write the openAPI specification to.
	 *
	 * Specify this to create the openAPI specification file
	*/
	specOutputPath?: string;

	/** either the Swagger specification or a function with one argument, which returns the spec */
	predefinedSpec?: object | OpenAPIV2.Document | ((spec: OpenAPIV2.Document) => OpenAPIV2.Document);

	/** how often to write the openAPI specification to file */
	writeIntervalMs?: number;
}

export function handleResponses(expressApp: Express, options: HandleResponsesOptions): void;

export function handleRequests(): void;

export function init(
	expressApp: Express,
	predefinedSpec?: HandleResponsesOptions['predefinedSpec'],
	specOutputPath?: HandleResponsesOptions['specOutputPath'],
	writeIntervalMs?: HandleResponsesOptions['writeIntervalMs'],
	swaggerUiServePath?: HandleResponsesOptions['swaggerUiServePath']
): void;

export const getSpec: () => object | OpenAPIV2.Document;

export const setPackageInfoPath: (pkgInfoPath: string) => void;
