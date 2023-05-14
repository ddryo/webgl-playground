// 必要なモジュールを読み込み
import * as THREE from './lib/three.module.js';
import { OrbitControls } from './lib/OrbitControls.js';

// DOM がパースされたことを検出するイベントを設定
window.addEventListener(
	'DOMContentLoaded',
	() => {
		// 制御クラスのインスタンスを生成
		const app = new App3();
		// 初期化
		app.init();
		// 描画
		app.render();
	},
	false
);

/**
 * three.js を効率よく扱うために自家製の制御クラスを定義
 */
class App3 {
	// カメラの設定
	static get CAMERA_PARAM() {
		return {
			fovy: 80,
			aspect: window.innerWidth / window.innerHeight,
			near: 0.1,
			far: 50.0,
			x: 0.0,
			y: 0.0,
			z: 20.0,
			lookAt: new THREE.Vector3(0.0, 0.0, 0.0),
		};
	}

	// レンダラーの設定
	static get RENDERER_PARAM() {
		return {
			clearColor: 0x222222, // レンダラーが背景をリセットする際に使われる背景色
			width: window.innerWidth,
			height: window.innerHeight,
		};
	}

	/**
	 * コンストラクタ
	 * @constructor
	 */
	constructor() {
		this.renderer; // レンダラ
		this.scene; // シーン
		this.camera; // カメラ
		this.boxGroups; // BOXメッシュの配列
		this.controls; // オービットコントロール

		this.isDown1 = false; // キーの押下状態を保持するフラグ
		this.isDown2 = false; // キーの押下状態を保持するフラグ
		this.isDown3 = false; // キーの押下状態を保持するフラグ

		// 再帰呼び出しのための this 固定
		this.render = this.render.bind(this);

		// キーの押下や離す操作を検出できるようにする
		window.addEventListener(
			'keydown',
			(keyEvent) => {
				switch (keyEvent.key) {
					case '1':
						this.isDown1 = true;
						break;
					case '2':
						this.isDown2 = true;
						break;
					case '3':
						this.isDown3 = true;
						break;
					default:
				}
			},
			false
		);
		window.addEventListener(
			'keyup',
			(keyEvent) => {
				switch (keyEvent.key) {
					case '1':
						this.isDown1 = false;
						break;
					case '2':
						this.isDown2 = false;
						break;
					case '3':
						this.isDown3 = false;
						break;
					default:
				}
			},
			false
		);

		// リサイズイベント
		window.addEventListener(
			'resize',
			() => {
				this.renderer.setSize(window.innerWidth, window.innerHeight);
				this.camera.aspect = window.innerWidth / window.innerHeight;
				this.camera.updateProjectionMatrix();
			},
			false
		);
	}

	/**
	 * 初期化処理
	 */
	init() {
		// レンダラー
		this.renderer = new THREE.WebGLRenderer();
		this.renderer.setClearColor(new THREE.Color(App3.RENDERER_PARAM.clearColor));
		this.renderer.setSize(App3.RENDERER_PARAM.width, App3.RENDERER_PARAM.height);
		const wrapper = document.querySelector('#webgl');
		wrapper.appendChild(this.renderer.domElement);

		// シーン
		this.scene = new THREE.Scene();

		// カメラ
		this.camera = new THREE.PerspectiveCamera(
			App3.CAMERA_PARAM.fovy,
			App3.CAMERA_PARAM.aspect,
			App3.CAMERA_PARAM.near,
			App3.CAMERA_PARAM.far
		);
		this.camera.position.set(App3.CAMERA_PARAM.x, App3.CAMERA_PARAM.y, App3.CAMERA_PARAM.z);
		this.camera.lookAt(App3.CAMERA_PARAM.lookAt);

		// ディレクショナルライト（平行光源）
		// https://threejs.org/docs/index.html?q=DirectionalLight#api/en/lights/DirectionalLight
		const directionalLight = new THREE.DirectionalLight(0xffffff, 1.0);
		directionalLight.position.set(1.0, 1.0, 2.0); // xyzでベクトル指定

		// アンビエントライト（環境光）
		const ambientLight = new THREE.AmbientLight(0xffffff, 0.75);

		// 点光源
		// https://threejs.org/docs/index.html?q=PointLight#api/en/lights/PointLight
		// memo: 公式ドキュメントを読むと、 decay (光の減衰率) はあまり指定しないほうがよさそう？
		const pointLight = new THREE.PointLight(0xaa55dd, 0.2, 100);
		pointLight.position.set(0, 0, 0);
		pointLight.castShadow = true; // 影を落とす設定。（高負荷）

		// 各ライトをシーンに追加
		this.scene.add(directionalLight);
		this.scene.add(ambientLight);
		this.scene.add(pointLight);

		// 照明を可視化するヘルパー
		// this.scene.add(new THREE.PointLightHelper(pointLight));

		// boxグループを保存する配列
		this.boxGroups = [];

		// ct個のBOXを、perspectiveに指定した軸方向から見た半径rの円周上に均等配置する。
		const setBox = (boxGeometry, ct, r, perspective, color) => {
			// マテリアル
			const material = new THREE.MeshStandardMaterial({
				color,
				roughness: 0.5,
				metalness: 0.8,
				// wireframe: true,
			});

			// 同一円周上のBOXたちをグループ化するためのもの
			// https://threejs.org/docs/index.html?q=Group#api/en/objects/Group
			const group = new THREE.Group();

			// 要素ごとの角度の増加値 θ[deg]
			const INCREMENT_DEG = 360 / ct;

			// それを radian に変換 ( rad = deg * (π / 180) )
			const INCREMENT_RAD = (INCREMENT_DEG * Math.PI) / 180;

			// 指定された個数のBOXの座標をそれぞれ計算してGrupに追加する
			for (let i = 0; i < ct; i++) {
				// Mesh生成
				const mesh = new THREE.Mesh(boxGeometry, material);

				// 配置座標を 角度[rad] と 半径r から計算し、指定された視点 (perspective) から見た平面上に配置
				if (perspective === 'z') {
					const x = r * Math.cos(i * INCREMENT_RAD);
					const y = r * Math.sin(i * INCREMENT_RAD);
					mesh.position.set(x, y, 0);
				} else if (perspective === 'y') {
					const x = r * Math.cos(i * INCREMENT_RAD);
					const z = r * Math.sin(i * INCREMENT_RAD);
					mesh.position.set(x, 0, z);
				} else if (perspective === 'x') {
					const y = r * Math.cos(i * INCREMENT_RAD);
					const z = r * Math.sin(i * INCREMENT_RAD);
					mesh.position.set(0, y, z);
				}

				// グループに追加する
				group.add(mesh);
			}

			// グループをシーンに追加する
			this.scene.add(group);

			// キー操作できるようにグループを配列に保存しておく
			this.boxGroups.push({ group, perspective, r });
		};

		// BOXジオメトリ、個数、半径、視点、色を指定してBoxグループを作成
		setBox(new THREE.BoxGeometry(1.0, 1.0, 1.0), 20, 5, 'x', 0x1188ff);
		setBox(new THREE.BoxGeometry(0.9, 0.9, 0.9), 30, 7.5, 'y', 0x11bbff);
		setBox(new THREE.BoxGeometry(0.8, 0.8, 0.8), 50, 10, 'z', 0x22eeff);

		// OrbitControls
		this.controls = new OrbitControls(this.camera, this.renderer.domElement);

		// 軸ヘルパー
		// this.scene.add(new THREE.AxesHelper(5.0));
	}

	/**
	 * 描画処理
	 */
	render() {
		// 恒常ループの設定
		requestAnimationFrame(this.render);

		// コントロールを更新 memo: なくても動いた
		// this.controls.update();

		// キー操作に応じて回転
		if (this.isDown1 === true) {
			this.boxGroups.forEach((groupData) => {
				if (groupData.perspective === 'x') {
					groupData.group.rotation.x += 0.005 + 0.002 * groupData.r;
				} else if (groupData.perspective === 'y') {
					groupData.group.rotation.y += 0.005 + 0.002 * groupData.r;
				} else if (groupData.perspective === 'z') {
					groupData.group.rotation.z += 0.005 + 0.002 * groupData.r;
				}
			});
		}

		if (this.isDown2 === true) {
			this.boxGroups.forEach((groupData) => {
				console.log(groupData);
				if (groupData.perspective === 'y') {
					groupData.group.rotation.x += 0.005 + 0.002 * groupData.r;
				} else if (groupData.perspective === 'z') {
					groupData.group.rotation.y += 0.005 + 0.002 * groupData.r;
				} else if (groupData.perspective === 'x') {
					groupData.group.rotation.z += 0.005 + 0.002 * groupData.r;
				}
			});
		}

		if (this.isDown3 === true) {
			this.boxGroups.forEach((groupData) => {
				console.log(groupData);
				if (groupData.perspective === 'z') {
					groupData.group.rotation.x += 0.005 + 0.002 * groupData.r;
				} else if (groupData.perspective === 'x') {
					groupData.group.rotation.y += 0.005 + 0.002 * groupData.r;
				} else if (groupData.perspective === 'y') {
					groupData.group.rotation.z += 0.005 + 0.002 * groupData.r;
				}
			});
		}

		// レンダラーで描画
		this.renderer.render(this.scene, this.camera);
	}
}
