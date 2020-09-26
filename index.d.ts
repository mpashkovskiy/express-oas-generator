// Type definitions for express-oas-generator 1.0.17
// Project: https://github.com/mpashkovskiy/express-oas-generator
// Definitions by: Kipras Melnikovas <https://github.com/sarpik>

/**
 * Make sure to check out
 * https://www.typescriptlang.org/docs/handbook/declaration-files/publishing.html
 */

import { Express } from 'express';
import { OpenAPIV2,OpenAPIV3 } from 'openapi-types';

/** re-export for ease of use for the end user */
export {
	OpenAPIV2,
	OpenAPIV3
};

/** Options for `handleResponses` */
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
	predefinedSpec?: object | OpenAPIV2.Document | OpenAPIV3.Document | 
		((spec: OpenAPIV2.Document) => OpenAPIV2.Document) | 
		((spec: OpenAPIV3.Document) => OpenAPIV3.Document);

	/** how often to write the openAPI specification to file */
	writeIntervalMs?: number;

	/** Mongoose model names */
	mongooseModels?: Array<string>;

	/** Tags to be used */
	tags?: Array<string>;

	/** Ignored node environments */
	ignoredNodeEnvironments?: Array<string>

	/** Always serve api docs */
	alwaysServeDocs?: boolean
}

/**
 * Apply this **first**!
 *
 * (straight after creating the express app (as the very first middleware))
 *
 * @description apply the `response` middleware.
 */
export function handleResponses(expressApp: Express, options: HandleResponsesOptions): void;

/**
 * Apply this **last**!
 *
 * (as the very last middleware of your express app)
 *
 * @description apply the `request` middleware
 * Applies to the `app` you provided in `handleResponses`
 *
 * Also, since this is the last function you'll need to invoke,
 * it also initializes the specification and serves the api documentation.
 * The options are for these tasks.
 */
export function handleRequests(): void;

/**
 * @warn it's preferred that you use `handleResponses`,
 * `handleRequests` and `serveApiDocs` **individually**
 * and not directly from this `init` function,
 * because we need `handleRequests` to be placed as the
 * very last middleware and we cannot guarantee this here,
 * since we're only using an arbitrary setTimeout of `1000` ms.
 *
 * See
 * https://github.com/mpashkovskiy/express-oas-generator/pull/32#issuecomment-546807216
 *
 * @description initialize the `express-oas-generator`.
 *
 * This will apply both `handleResponses` and `handleRequests`
 * and also will call `serveApiDocs`.
 */
export function init(
	expressApp: Express,
	predefinedSpec?: HandleResponsesOptions['predefinedSpec'],
	specOutputPath?: HandleResponsesOptions['specOutputPath'],
	writeIntervalMs?: HandleResponsesOptions['writeIntervalMs'],
	swaggerUiServePath?: HandleResponsesOptions['swaggerUiServePath'],
	mongooseModels?: HandleResponsesOptions['mongooseModels'],
	tags?: HandleResponsesOptions['tags'],
	ignoredNodeEnvironments?: HandleResponsesOptions['ignoredNodeEnvironments'],
	alwaysServeDocs?: HandleResponsesOptions['alwaysServeDocs']
): void;

export const getSpec: () => object | OpenAPIV2.Document;

export const getSpecV3: (callback: (err: object | string, specV3: object | OpenAPIV3.Document) => void) => void

export const setPackageInfoPath: (pkgInfoPath: string) => void;
