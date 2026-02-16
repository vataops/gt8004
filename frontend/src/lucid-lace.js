import { Lucid, Blockfrost } from '@lucid-evolution/lucid';

// 초기화된 Lucid를 전역에 캐시
let _lucid = null;
let _lucidNetwork = null;

/**
 * 현재 초기화된 Lucid 인스턴스 반환 (지갑 연결 후에만 유효)
 */
export function getLucid() {
	return _lucid;
}

/**
 * 설정: 실제 프로젝트 키로 교체하세요.
 * Mainnet 키를 사용하면 Mainnet으로, Preview 키를 사용하면 Preview로 연결됩니다.
 */
const BLOCKFROST_KEYS = {
	Mainnet: 'YOUR_MAINNET_BLOCKFROST_KEY', // <-- 여기에 Mainnet 키 넣기
	Preview: 'previewxYyB0Uj87BX2fEUwMVgsMuq8OYdvaOFe'
};
const BLOCKFROST_ENDPOINTS = {
	Mainnet: 'https://cardano-mainnet.blockfrost.io/api/v0',
	Preview: 'https://cardano-preview.blockfrost.io/api/v0'
};

/**
 * Lucid 초기화 (Preview 네트워크, 필요시 키/네트워크 교체)
 */
export async function initLucid(network = 'Preview') {
	if (_lucid && _lucidNetwork === network) return _lucid;

	const key = BLOCKFROST_KEYS[network];
	if (!key || key.startsWith('YOUR_')) {
		throw new Error(`Blockfrost key for ${network} is not configured in lucid-lace.js`);
	}

	_lucid = await Lucid(
		new Blockfrost(BLOCKFROST_ENDPOINTS[network], key),
		network
	);
	_lucidNetwork = network;
	return _lucid;
}

/**
 * Lace에 연결하고 실제 네트워크를 감지하여 Lucid 초기화 후 주소 반환
 */
export async function connectLace() {
	if (!window.cardano?.lace) {
		throw new Error('Lace 지갑이 설치되지 않았습니다.');
	}

	const walletApi = await window.cardano.lace.enable();

	// 지갑의 네트워크 id 감지 (CIP-30 getNetworkId)
	let networkId = null;
	try {
		networkId = await walletApi.getNetworkId();
	} catch (e) {
		// 일부 환경에서는 지원되지 않을 수 있으므로 실패 시 Preview로 기본 처리
		networkId = null;
	}

	const network = networkId === 1 ? 'Mainnet' : 'Preview';

	const lucid = await initLucid(network);
	lucid.selectWallet.fromAPI(walletApi);

	const address = await lucid.wallet().address();
	return { address, network };
}
