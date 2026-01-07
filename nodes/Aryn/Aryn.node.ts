import type {
	IExecuteFunctions,
	INodeExecutionData,
	INodeType,
	INodeTypeDescription,
	IHttpRequestOptions,
} from 'n8n-workflow';
import { NodeConnectionTypes, NodeOperationError } from 'n8n-workflow';
type BinaryBuffer = { length: number };
declare const Buffer: {
    from(input: string, encoding: string): BinaryBuffer;
    concat(chunks: Array<unknown>): BinaryBuffer;
};

export class Aryn implements INodeType {
	description: INodeTypeDescription = {
		// Basic node details will go here
		displayName: 'Aryn',
		name: 'aryn',
		icon: 'file:ArynCircleLogo.svg',
		group: ['transform'],
		version: 0,
		subtitle: '={{ $parameter["operation"] }}',
		description: 'Consume Aryn API',
		defaults: {
			name: 'Aryn',
		},
		inputs: [NodeConnectionTypes.Main],
		outputs: [NodeConnectionTypes.Main],
		usableAsTool: true,
		credentials: [
			{
				name: 'arynApi',
				required: true,
			},
		],
		requestDefaults: {
			baseURL: 'https://api.aryn.ai',
			headers: {
				Accept: 'application/json',
				'Content-Type': 'application/json',
			},
		},
		properties: [
			{
				displayName: 'Operation',
				name: 'operation',
				type: 'options',
				options: [
					{
						name: 'Parse Document',
						value: 'parse',
						description: 'Parse a document into structured data',
						action: 'Parse a document',
					},
				],
				default: 'parse',
				noDataExpression: true,
			},
			{
				displayName: 'Input Binary Field',
				name: 'binaryPropertyName',
				type: 'string',
				default: 'data',
				required: true,
				placeholder: 'e.g data or File',
				hint: 'The name of the input binary field containing the file to be extracted',
			},
			{
				displayName: "Text Mode",
				name: "textMode",
				type: "options",
				default: "auto",
				noDataExpression: true,
				options: [
					{
						name: "Auto",
						value: "auto",
						description: "Let Aryn decide the best text extraction method",
						action: "auto"
					},
					{
						name: "OCR Standard",
						value: "ocr_standard",
						description: "Use Optical Character Recognition to extract text",
						action: "ocr_standard"
					},
					{
						name: "OCR Vision",
						value: "ocr_vision",
						description: "Use a vision language model to augment OCR extraction",
						action: "ocr_vision"
					}
				],
			},
			{
				displayName: "Table Mode",
				name: "tableMode",
				type: "options",
				default: "none",
				noDataExpression: true,
				options: [
					{
						name: "None",
						value: "none",
						description: "Do not extract tables",
						action: "none"
					},
					{
						name: "Standard",
						value: "standard",
						description: "Use standard table extraction",
						action: "standard"
					},
					{
						name: "Vision",
						value: "vision",
						description: "Use a vision language model to enhance table extraction",
						action: "vision"
					}
				],
			},
			{
				displayName: "Output Format",
				name: "outputFormat",
				type: "options",
				default: "json",
				noDataExpression: true,
				options: [
					{
						name: "JSON",
						value: "json",
						description: "Receive the output in JSON format",
						action: "json"
					},
					{
						name: "HTML",
						value: "html",
						description: "Receive the output in HTML format",
						action: "html"
					},
					{
						name: "Markdown",
						value: "markdown",
						description: "Receive the output in Markdown format",
						action: "markdown"
					}
				],
			},
			{
				displayName: "Extract Images",
				name: "extractImages",
				type: "boolean",
				default: false,
				description: "Whether to extract images from the document",				
			},
			{
				displayName: "Summarize Images",
				name: "summarizeImages",
				type: "boolean",
				default: false,
				description: "Whether to generate summaries for images using AI",
			},
			{
				displayName: "Property Extraction Schema",
				name: "propertyExtractionSchema",
				type: "json",
				default: '',
				description: 'A JSON schema defining the properties to extract from the document using Aryn\'s property extraction feature',
			}
		]
	};

	// The execute method will go here
	async execute(this: IExecuteFunctions): Promise<INodeExecutionData[][]> {
		// Handle data coming from previous nodes
		const items = this.getInputData();
		const returnData: INodeExecutionData[] = [];
		const operation = this.getNodeParameter('operation', 0) as string;

		const textMode = this.getNodeParameter('textMode', 0, 'auto') as string;
		const tableMode = this.getNodeParameter('tableMode', 0, 'none') as string;
		const outputFormat = this.getNodeParameter('outputFormat', 0, 'json') as string;
		const extractImages = this.getNodeParameter('extractImages', 0, false) as boolean;
		const summarizeImages = this.getNodeParameter('summarizeImages', 0, false) as boolean;
		const propertyExtractionSchema = this.getNodeParameter('propertyExtractionSchema', 0, '') as string;

		// For each item, make an API call to create a contact
		for (let i = 0; i < items.length; i++) {
			const binaryPropertyName = this.getNodeParameter('binaryPropertyName', i) as string;
			const binaryData = this.helpers.assertBinaryData(i, binaryPropertyName);

			const buffer = await this.helpers.getBinaryDataBuffer(i, binaryPropertyName);

			const optionsObj: {[key: string]: unknown} = {
				text_mode: textMode,
				output_format: outputFormat,
				extract_images: extractImages,
				summarize_images: summarizeImages,
			};
			if (tableMode !== 'none') {
				optionsObj['table_mode'] = tableMode;
			}
			if (propertyExtractionSchema) {
				optionsObj['property_extraction_options'] = {
					schema: propertyExtractionSchema
				};
			}
			const fileName = binaryData.fileName ?? 'file';
			const mimeType = binaryData.mimeType ?? 'application/octet-stream';

			const optionStr = JSON.stringify(optionsObj);

			// Build multipart/form-data body manually (Drive-like approach without external imports)
			const boundary = `----n8nFormBoundary${Date.now()}`;
			const preamble =
				`--${boundary}\r\n` +
				`Content-Disposition: form-data; name="file"; filename="${fileName}"\r\n` +
				`Content-Type: ${mimeType}\r\n\r\n`;
			const optionsPart =
				`\r\n--${boundary}\r\n` +
				`Content-Disposition: form-data; name="options"\r\n` +
				`Content-Type: text/plain\r\n\r\n` +
				optionStr;
			const closing = `\r\n--${boundary}--\r\n`;
			const bodyBuffer = Buffer.concat([
				Buffer.from(preamble, 'utf8'),
				buffer as unknown as BinaryBuffer,
				Buffer.from(optionsPart, 'utf8'),
				Buffer.from(closing, 'utf8'),
			]);

			this.logger.info(`Form Data: ${JSON.stringify(bodyBuffer)}`);
			if (operation === 'parse') {
				// Make HTTP request
				const options: IHttpRequestOptions = {
					method: 'POST',
					url: `https://api.aryn.ai/v1/document/partition`,
					headers: {
						'Accept': 'application/json',
						'source': 'n8n',
						'Content-Type': `multipart/form-data; boundary=${boundary}`,
						'Content-Length': (bodyBuffer as unknown as BinaryBuffer).length
					},
					body: bodyBuffer,
					json: true,

				};
				try {
					const responseData = await this.helpers.httpRequestWithAuthentication.call(this, 'arynApi', options);
					
					delete responseData.status;
					delete responseData.status_code;
					delete responseData.page_count;

					returnData.push(responseData);
				} catch (error) {
					if (this.continueOnFail()) {
						returnData.push({ json: { error: error.message } });
						continue;
					}
					throw new NodeOperationError(this.getNode(), error as Error, { itemIndex: i });
				}
			}
		}
		// Map data to n8n data structure
		return [this.helpers.returnJsonArray(returnData)];
	}
}
