import {
	IAuthenticateGeneric,
	Icon,
	ICredentialTestRequest,
	ICredentialType,
	INodeProperties,
} from 'n8n-workflow';

export class ArynApi implements ICredentialType {
	name = 'arynApi';
	displayName = 'Aryn API';
	documentationUrl = 'https://docs.aryn.ai/';
	icon: Icon = { light: 'file:../icons/ArynCircleLogo.svg', dark: 'file:../icons/ArynCircleLogo.dark.svg' };
	properties: INodeProperties[] = [
		{
			displayName: 'API Key',
			name: 'apiKey',
			type: 'string',
			typeOptions: {
				password: true,
			},
			default: '',
		},
	];

	authenticate: IAuthenticateGeneric = {
		type: 'generic',
		properties: {
			headers: {
				Authorization: '=Bearer {{$credentials.apiKey}}',
			},
		},
	};

	test: ICredentialTestRequest = {
		request: {
			baseURL: 'https://api.aryn.ai',
			method: "POST",
			url: '/v1/token/validate',
		},
	};
}
