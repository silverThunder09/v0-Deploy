// ==============================
// 전역 변수
// ==============================
let places = []; // 전체 맛집 목록
let filteredPlaces = []; // 필터링된 맛집 목록
let currentEditId = null; // 현재 수정 중인 ID
let currentFilter = 'all'; // 현재 카테고리 필터

// 카카오맵 기본 중심 좌표
const DEFAULT_MAP_LAT = 37.5665; // 서울 시청 위도
const DEFAULT_MAP_LNG = 126.9780; // 서울 시청 경도

// 등록/수정 모드별 설정
const mapConfigs = {
  add: {
    formId: 'addPlaceForm',
    modalId: 'addPlaceModal',
    nameId: 'addName',
    addressId: 'addAddress',
    categoryId: 'addCategory',
    callId: 'addCall',
    latId: 'addLat',
    lngId: 'addLng',
    ratingName: 'addRating',
    searchBtnId: 'searchPlaceByNameBtn',
    resultBoxId: 'placeSearchResult',
    mapId: 'addMap',
    formType: 'add',
  },
  edit: {
    formId: 'editPlaceForm',
    modalId: 'editPlaceModal',
    nameId: 'editName',
    addressId: 'editAddress',
    categoryId: 'editCategory',
    callId: 'editCall',
    latId: 'editLat',
    lngId: 'editLng',
    ratingName: 'editRating',
    searchBtnId: 'editSearchPlaceByNameBtn',
    resultBoxId: 'editPlaceSearchResult',
    mapId: 'editMap',
    formType: 'edit',
  },
};

// 등록/수정 모드별 지도 상태
const mapState = {
  add: {
    map: null,
    marker: null,
    placeService: null,
    geocoder: null,
  },
  edit: {
    map: null,
    marker: null,
    placeService: null,
    geocoder: null,
  },
};

// ==============================
// 초기 실행
// ==============================
document.addEventListener('DOMContentLoaded', function () {
  setupEventListeners(); // 이벤트 리스너 설정
  initializeKakaoMaps(); // 등록/수정 지도 초기화
  loadPlaces(); // 목록 조회
});

// ==============================
// 공통 DOM 유틸
// ==============================
function el(id) {
  return document.getElementById(id); // id로 요소 찾기
}

function getDefaultLatLng() {
  return new kakao.maps.LatLng(DEFAULT_MAP_LAT, DEFAULT_MAP_LNG); // 기본 중심 좌표 반환
}

function escapeHtml(text) {
  const div = document.createElement('div'); // 임시 div 생성
  div.textContent = text == null ? '' : String(text); // textContent로 안전하게 넣기
  return div.innerHTML; // HTML escape 결과 반환
}

function escapeAttr(text) {
  return String(text == null ? '' : text)
    .replace(/&/g, '&amp;') // & escape
    .replace(/"/g, '&quot;') // " escape
    .replace(/'/g, '&#39;') // ' escape
    .replace(/</g, '&lt;') // < escape
    .replace(/>/g, '&gt;'); // > escape
}

// ==============================
// 이벤트 리스너 설정
// ==============================
function setupEventListeners() {
  // 등록 폼 제출
  if (el(mapConfigs.add.formId)) {
    el(mapConfigs.add.formId).addEventListener('submit', handleAddPlace);
  }

  // 수정 폼 제출
  if (el(mapConfigs.edit.formId)) {
    el(mapConfigs.edit.formId).addEventListener('submit', handleEditPlace);
  }

  // 필터 탭 클릭
  document.querySelectorAll('.filter-tab').forEach((tab) => {
    tab.addEventListener('click', function () {
      document.querySelectorAll('.filter-tab').forEach((t) => t.classList.remove('active')); // active 제거
      this.classList.add('active'); // 현재 탭 활성화
      currentFilter = this.dataset.filter; // 현재 필터 저장
      filterPlaces(); // 목록 필터링
    });
  });

  // 등록 검색 버튼
  if (el(mapConfigs.add.searchBtnId)) {
    el(mapConfigs.add.searchBtnId).addEventListener('click', function () {
      handleSearchPlaceByName('add'); // 등록 모달 이름 검색
    });
  }

  // 수정 검색 버튼
  if (el(mapConfigs.edit.searchBtnId)) {
    el(mapConfigs.edit.searchBtnId).addEventListener('click', function () {
      handleSearchPlaceByName('edit'); // 수정 모달 이름 검색
    });
  }

  // 등록 모달 열릴 때 지도 재계산
  if (el(mapConfigs.add.modalId)) {
    el(mapConfigs.add.modalId).addEventListener('shown.bs.modal', function () {
      refreshMapLayout('add'); // 지도 잘림 방지
    });

    el(mapConfigs.add.modalId).addEventListener('hidden.bs.modal', function () {
      resetModeForm('add'); // 등록 모달 초기화
    });
  }

  // 수정 모달 열릴 때 지도 재계산
  if (el(mapConfigs.edit.modalId)) {
    el(mapConfigs.edit.modalId).addEventListener('shown.bs.modal', function () {
      refreshMapLayout('edit'); // 지도 잘림 방지
    });

    el(mapConfigs.edit.modalId).addEventListener('hidden.bs.modal', function () {
      resetModeForm('edit'); // 수정 모달 초기화
      currentEditId = null; // 수정 ID 초기화
    });
  }
}

// ==============================
// 모달/지도 공통 처리
// ==============================
function resetModeForm(mode) {
  const config = mapConfigs[mode]; // 모드 설정
  const form = el(config.formId); // 폼 찾기

  if (form) {
    form.reset(); // 폼 초기화
  }

  resetStarRating(config.formType); // 별점 초기화
  clearSearchResults(mode); // 검색 결과 초기화
  clearMapSelection(mode); // 지도/좌표 초기화
}

function resetStarRating(formType) {
  const stars = document.querySelectorAll(`#${formType}PlaceForm .star-rating-input input`); // 별점 input 찾기
  stars.forEach((star) => {
    star.checked = false; // 전부 체크 해제
  });
}

function refreshMapLayout(mode) {
  const state = mapState[mode]; // 모드별 지도 상태
  const config = mapConfigs[mode]; // 모드별 설정

  if (!state.map || !window.kakao || !window.kakao.maps) {
    return; // 지도 없으면 종료
  }

  setTimeout(() => {
    state.map.relayout(); // 모달 안에서 잘린 지도 재계산

    const lat = el(config.latId)?.value; // 저장된 위도
    const lng = el(config.lngId)?.value; // 저장된 경도

    if (lat && lng) {
      const target = new kakao.maps.LatLng(Number(lat), Number(lng)); // 기존 좌표로 이동
      state.map.setCenter(target);
      if (state.marker) {
        state.marker.setMap(state.map);
        state.marker.setPosition(target);
      }
    } else {
      state.map.setCenter(getDefaultLatLng()); // 기본 좌표로 이동
    }
  }, 150); // 모달 애니메이션 후 살짝 늦게 실행
}

// ==============================
// 카카오맵 초기화
// ==============================
function initializeKakaoMaps() {
  if (!window.kakao || !window.kakao.maps || !window.kakao.maps.services) {
    console.error('Kakao Maps SDK 또는 services 라이브러리가 로드되지 않았습니다.');
    return;
  }

  initializeSingleMap('add'); // 등록 지도 생성
  initializeSingleMap('edit'); // 수정 지도 생성
}

function initializeSingleMap(mode) {
  const config = mapConfigs[mode]; // 모드 설정
  const state = mapState[mode]; // 모드 상태
  const mapContainer = el(config.mapId); // 지도 div

  if (!mapContainer) {
    return; // 지도 div 없으면 종료
  }

  const defaultCenter = getDefaultLatLng(); // 기본 중심

  state.map = new kakao.maps.Map(mapContainer, {
    center: defaultCenter, // 중심 좌표
    level: 3, // 확대 레벨
  });

  state.placeService = new kakao.maps.services.Places(); // 장소 검색 객체
  state.geocoder = new kakao.maps.services.Geocoder(); // 주소 변환 객체

  // 지도 클릭 시 마커 이동 + 주소 반영
  kakao.maps.event.addListener(state.map, 'click', function (mouseEvent) {
    const latLng = mouseEvent.latLng; // 클릭 좌표 추출
    setMapMarker(mode, latLng); // 마커 이동
    fillAddressByCoords(mode, latLng); // 주소 반영
  });
}

function setMapMarker(mode, latLng) {
  const config = mapConfigs[mode]; // 모드 설정
  const state = mapState[mode]; // 모드 상태

  if (!state.map) {
    return; // 지도 없으면 종료
  }

  if (!state.marker) {
    state.marker = new kakao.maps.Marker({
      position: latLng, // 초기 위치 설정
    });
  }

  state.marker.setPosition(latLng); // 마커 좌표 이동
  state.marker.setMap(state.map); // 지도에 표시

  el(config.latId).value = String(latLng.getLat()); // 위도 저장
  el(config.lngId).value = String(latLng.getLng()); // 경도 저장
}

async function fillAddressByCoords(mode, latLng) {
  try {
    const address = await getAddressFromCoords(mode, latLng.getLng(), latLng.getLat()); // 좌표->주소 변환
    const config = mapConfigs[mode]; // 모드 설정

    if (address) {
      el(config.addressId).value = address; // 주소 입력칸 반영
    }
  } catch (error) {
    console.error('주소 변환 실패:', error);
  }
}

async function getAddressFromCoords(mode, lng, lat) {
  return new Promise((resolve, reject) => {
    const state = mapState[mode]; // 모드 상태

    if (!state.geocoder) {
      reject(new Error('카카오 지오코더가 초기화되지 않았습니다.'));
      return;
    }

    state.geocoder.coord2Address(lng, lat, function (result, status) {
      if (status !== kakao.maps.services.Status.OK) {
        reject(new Error('좌표를 주소로 변환하지 못했습니다.'));
        return;
      }

      const first = result && result[0] ? result[0] : null; // 첫 번째 결과
      if (!first) {
        resolve('');
        return;
      }

      const roadAddress = first.road_address ? first.road_address.address_name : ''; // 도로명 주소
      const jibunAddress = first.address ? first.address.address_name : ''; // 지번 주소

      resolve(roadAddress || jibunAddress || ''); // 도로명 우선
    });
  });
}

function clearMapSelection(mode) {
  const config = mapConfigs[mode]; // 모드 설정
  const state = mapState[mode]; // 모드 상태

  if (el(config.latId)) {
    el(config.latId).value = ''; // 위도 초기화
  }
  if (el(config.lngId)) {
    el(config.lngId).value = ''; // 경도 초기화
  }

  if (state.marker) {
    state.marker.setMap(null); // 마커 제거
    state.marker = null; // 마커 객체 초기화
  }

  if (state.map) {
    state.map.setCenter(getDefaultLatLng()); // 기본 중심 복원
  }
}

// ==============================
// 이름 검색
// ==============================
async function handleSearchPlaceByName(mode) {
  const config = mapConfigs[mode]; // 모드 설정
  const keyword = el(config.nameId)?.value.trim() || ''; // 이름 입력값

  if (!keyword) {
    showValidationError('먼저 가게 이름을 입력해주세요.');
    return;
  }

  try {
    Swal.fire({
      title: '장소 검색 중...',
      allowOutsideClick: false,
      didOpen: () => Swal.showLoading(),
    });

    const results = await searchPlacesByKeyword(mode, keyword); // 키워드 검색
    Swal.close();

    if (!results.length) {
      clearSearchResults(mode); // 결과 비우기
      showValidationError('검색 결과가 없습니다. 다른 이름으로 다시 시도해주세요.');
      return;
    }

    renderSearchResults(mode, results); // 결과 렌더링
  } catch (error) {
    Swal.fire({
      icon: 'error',
      title: '검색 실패',
      text: error.message || '장소 검색 중 오류가 발생했습니다.',
      confirmButtonColor: '#2563eb',
    });
  }
}

async function searchPlacesByKeyword(mode, keyword) {
  return new Promise((resolve, reject) => {
    const state = mapState[mode]; // 모드 상태

    if (!state.placeService) {
      reject(new Error('카카오 장소 검색 서비스가 초기화되지 않았습니다.'));
      return;
    }

    state.placeService.keywordSearch(keyword, function (data, status) {
      if (status === kakao.maps.services.Status.OK) {
        resolve(data); // 정상 결과
        return;
      }

      if (status === kakao.maps.services.Status.ZERO_RESULT) {
        resolve([]); // 결과 없음
        return;
      }

      reject(new Error('장소 검색 중 오류가 발생했습니다.'));
    });
  });
}

function renderSearchResults(mode, results) {
  const config = mapConfigs[mode]; // 모드 설정
  const container = el(config.resultBoxId); // 결과 컨테이너
  if (!container) return;

  container.innerHTML = results
    .slice(0, 5) // 상위 5개만 표시
    .map((place) => {
      const safeName = escapeHtml(place.place_name || ''); // 이름 escape
      const safeAddress = escapeHtml(place.road_address_name || place.address_name || ''); // 주소 escape
      const safePhone = escapeHtml(place.phone || ''); // 전화번호 escape

      return `
        <button
          type="button"
          class="w-100 text-start border rounded p-2 mb-2 bg-white"
          onclick="selectSearchResultFromButton(this)"
          data-mode="${escapeAttr(mode)}"
          data-name="${escapeAttr(place.place_name || '')}"
          data-address="${escapeAttr(place.road_address_name || place.address_name || '')}"
          data-phone="${escapeAttr(place.phone || '')}"
          data-lat="${escapeAttr(place.y || '')}"
          data-lng="${escapeAttr(place.x || '')}"
        >
          <div class="fw-semibold">${safeName}</div>
          <div class="small text-muted">${safeAddress}</div>
          <div class="small text-muted">${safePhone || '전화번호 없음'}</div>
        </button>
      `;
    })
    .join('');
}

window.selectSearchResultFromButton = function (buttonEl) {
  if (!buttonEl) return;

  const mode = buttonEl.dataset.mode || 'add'; // add/edit 구분
  const name = buttonEl.dataset.name || ''; // 이름
  const address = buttonEl.dataset.address || ''; // 주소
  const phone = buttonEl.dataset.phone || ''; // 전화번호
  const lat = buttonEl.dataset.lat || ''; // 위도
  const lng = buttonEl.dataset.lng || ''; // 경도

  selectSearchResult(mode, name, address, phone, lat, lng); // 결과 선택 처리
};

function selectSearchResult(mode, name, address, phone, lat, lng) {
  const config = mapConfigs[mode]; // 모드 설정
  const state = mapState[mode]; // 모드 상태

  if (!window.kakao || !window.kakao.maps || !state.map) {
    return;
  }

  const latLng = new kakao.maps.LatLng(Number(lat), Number(lng)); // 좌표 객체 생성

  el(config.nameId).value = name; // 이름 반영
  el(config.addressId).value = address; // 주소 반영
  if (phone) {
    el(config.callId).value = phone; // 전화번호 있으면 반영
  }

  el(config.latId).value = lat; // 위도 반영
  el(config.lngId).value = lng; // 경도 반영

  state.map.setCenter(latLng); // 지도 중심 이동
  setMapMarker(mode, latLng); // 마커 표시

  Swal.fire({
    icon: 'success',
    title: '장소 선택 완료',
    text: '지도에서 위치를 한 번 더 클릭하면 정확한 위치로 수정할 수 있습니다.',
    confirmButtonColor: '#2563eb',
    timer: 1800,
    timerProgressBar: true,
  });
}

function clearSearchResults(mode) {
  const config = mapConfigs[mode]; // 모드 설정
  const container = el(config.resultBoxId); // 결과 박스
  if (!container) return;

  container.innerHTML = `
    <div class="text-muted small">가게 이름으로 검색하면 결과가 여기에 표시됩니다.</div>
  `;
}

// ==============================
// 목록 조회 / 필터링 / 렌더링
// ==============================
async function loadPlaces() {
  showLoading(); // 로딩 UI 표시

  try {
    const result = await getAllPlaces(); // 전체 목록 조회

    if (!Array.isArray(result) || result.length === 0) {
      places = []; // 빈 배열 저장
      filteredPlaces = []; // 필터 결과 비움
      showEmptyState(); // 빈 상태 표시
      return;
    }

    places = result; // 목록 저장
    filterPlaces(); // 필터 적용 후 렌더링
  } catch (error) {
    console.error('맛집 목록 로드 실패:', error);
    places = []; // 실패 시 빈 배열
    filteredPlaces = []; // 필터 결과 비움
    showEmptyState(); // 빈 상태 표시
  }
}

function filterPlaces() {
  if (!Array.isArray(places) || places.length === 0) {
    filteredPlaces = []; // 빈 목록
    showEmptyState(); // 빈 상태 표시
    return;
  }

  if (currentFilter === 'all') {
    filteredPlaces = [...places]; // 전체 복사
  } else {
    filteredPlaces = places.filter((p) => p.category === currentFilter); // 카테고리 필터링
  }

  renderPlaces(); // 카드 렌더링
  updateCount(); // 개수 갱신
}

function updateCount() {
  if (el('displayCount')) {
    el('displayCount').textContent = String(filteredPlaces.length); // 개수 표시
  }
}

function showLoading() {
  const container = el('placesContainer'); // 카드 컨테이너
  if (!container) return;

  container.innerHTML = `
    <div class="loading-container">
      <div class="spinner"></div>
      <span class="loading-text">맛집 목록을 불러오는 중...</span>
    </div>
  `;
}

function showEmptyState() {
  const container = el('placesContainer'); // 카드 컨테이너
  if (!container) return;

  container.innerHTML = `
    <div class="empty-state">
      <div class="empty-icon">
        <i class="fas fa-utensils"></i>
      </div>
      <h3 class="empty-title">등록된 맛집이 없습니다</h3>
      <p class="empty-desc">새로운 맛집을 등록해보세요!</p>
    </div>
  `;

  updateCount(); // 개수도 0으로 반영
}

function renderPlaces() {
  const container = el('placesContainer'); // 카드 컨테이너
  if (!container) return;

  if (!filteredPlaces.length) {
    showEmptyState(); // 데이터 없으면 빈 상태
    return;
  }

  container.innerHTML = filteredPlaces
    .map(
      (place, index) => `
      <div class="card-animate" style="animation-delay: ${index * 0.05}s">
        <div class="place-card">
          <div class="card-top">
            <div class="card-header-row">
              <h3 class="card-title">${escapeHtml(place.name)}</h3>
              <span class="category-tag ${getCategoryClass(place.category)}">
                ${escapeHtml(place.category)}
              </span>
            </div>
            <div class="rating-display">
              <div class="rating-stars">
                ${renderStars(place.rating)}
              </div>
              <span class="rating-number">${Number(place.rating || 0)}.0</span>
            </div>
          </div>

          <div class="card-body">
            <div class="info-item">
              <div class="info-icon">
                <i class="fas fa-map-marker-alt"></i>
              </div>
              <div class="info-text">
                <div class="info-label">주소</div>
                <div class="info-value">${escapeHtml(place.address)}</div>
              </div>
            </div>

            <div class="info-item">
              <div class="info-icon">
                <i class="fas fa-phone"></i>
              </div>
              <div class="info-text">
                <div class="info-label">전화번호</div>
                <div class="info-value">${escapeHtml(place.call)}</div>
              </div>
            </div>
          </div>

          <div class="card-actions">
            <button class="btn-card btn-edit" onclick="openEditModal('${escapeAttr(place.id)}')">
              <i class="fas fa-pen"></i>
              수정
            </button>
            <button class="btn-card btn-delete" onclick="confirmDelete('${escapeAttr(place.id)}', '${escapeAttr(place.name)}')">
              <i class="fas fa-trash"></i>
              삭제
            </button>
          </div>
        </div>
      </div>
    `
    )
    .join('');
}

function renderStars(rating) {
  let stars = ''; // 별 문자열 초기화
  const safeRating = Number(rating || 0); // 숫자형 별점

  for (let i = 1; i <= 5; i++) {
    if (i <= safeRating) {
      stars += '<i class="fas fa-star"></i>'; // 채운 별
    } else {
      stars += '<i class="fas fa-star empty"></i>'; // 빈 별
    }
  }

  return stars;
}

function getCategoryClass(category) {
  const categoryMap = {
    한식: 'category-korean',
    중식: 'category-chinese',
    일식: 'category-japanese',
    양식: 'category-western',
    카페: 'category-cafe',
    기타: 'category-etc',
  };

  return categoryMap[category] || 'category-etc';
}

// ==============================
// 등록
// ==============================
async function handleAddPlace(e) {
  e.preventDefault(); // 기본 submit 막기

  const formData = {
    name: el(mapConfigs.add.nameId).value.trim(), // 이름
    address: el(mapConfigs.add.addressId).value.trim(), // 주소
    category: el(mapConfigs.add.categoryId).value, // 카테고리
    call: el(mapConfigs.add.callId).value.trim(), // 전화번호
    rating: parseInt(document.querySelector(`input[name="${mapConfigs.add.ratingName}"]:checked`)?.value || 0, 10), // 별점
    lat: el(mapConfigs.add.latId).value.trim(), // 위도
    lng: el(mapConfigs.add.lngId).value.trim(), // 경도
  };

  if (!validatePlaceForm(formData)) return; // 유효성 검사

  try {
    Swal.fire({
      title: '등록 중...',
      allowOutsideClick: false,
      didOpen: () => Swal.showLoading(),
    });

    await createPlace(formData); // 등록 API 호출

    Swal.fire({
      icon: 'success',
      title: '등록 완료',
      text: `'${formData.name}'이(가) 등록되었습니다.`,
      confirmButtonColor: '#2563eb',
      timer: 2000,
      timerProgressBar: true,
    });

    bootstrap.Modal.getInstance(el(mapConfigs.add.modalId)).hide(); // 등록 모달 닫기
    loadPlaces(); // 목록 새로고침
  } catch (error) {
    Swal.fire({
      icon: 'error',
      title: '등록 실패',
      text: error.message || '등록 중 오류가 발생했습니다.',
      confirmButtonColor: '#2563eb',
    });
  }
}

// ==============================
// 수정
// ==============================
window.openEditModal = function (id) {
  const place = places.find((p) => String(p.id) === String(id)); // 해당 맛집 찾기
  if (!place) return;

  currentEditId = id; // 현재 수정 ID 저장

  el(mapConfigs.edit.nameId).value = place.name || ''; // 이름 반영
  el(mapConfigs.edit.addressId).value = place.address || ''; // 주소 반영
  el(mapConfigs.edit.categoryId).value = place.category || ''; // 카테고리 반영
  el(mapConfigs.edit.callId).value = place.call || ''; // 전화번호 반영
  el(mapConfigs.edit.latId).value = place.lat || ''; // 위도 반영
  el(mapConfigs.edit.lngId).value = place.lng || ''; // 경도 반영

  clearSearchResults('edit'); // 이전 검색결과 초기화

  const ratingInput = document.querySelector(`input[name="${mapConfigs.edit.ratingName}"][value="${place.rating}"]`);
  if (ratingInput) {
    ratingInput.checked = true; // 별점 체크
  } else {
    resetStarRating('edit'); // 별점 없으면 초기화
  }

  // 기존 좌표가 있으면 마커도 같이 반영
  if (place.lat && place.lng && window.kakao && window.kakao.maps) {
    const latLng = new kakao.maps.LatLng(Number(place.lat), Number(place.lng)); // 기존 좌표
    if (mapState.edit.map) {
      mapState.edit.map.setCenter(latLng); // 중심 이동
    }
    setMapMarker('edit', latLng); // 마커 표시
  } else {
    clearMapSelection('edit'); // 좌표 없으면 초기화
  }

  new bootstrap.Modal(el(mapConfigs.edit.modalId)).show(); // 수정 모달 열기
};

async function handleEditPlace(e) {
  e.preventDefault(); // 기본 submit 막기

  const formData = {
    name: el(mapConfigs.edit.nameId).value.trim(), // 이름
    address: el(mapConfigs.edit.addressId).value.trim(), // 주소
    category: el(mapConfigs.edit.categoryId).value, // 카테고리
    call: el(mapConfigs.edit.callId).value.trim(), // 전화번호
    rating: parseInt(document.querySelector(`input[name="${mapConfigs.edit.ratingName}"]:checked`)?.value || 0, 10), // 별점
    lat: el(mapConfigs.edit.latId).value.trim(), // 위도
    lng: el(mapConfigs.edit.lngId).value.trim(), // 경도
  };

  if (!validatePlaceForm(formData)) return; // 유효성 검사

  try {
    Swal.fire({
      title: '수정 중...',
      allowOutsideClick: false,
      didOpen: () => Swal.showLoading(),
    });

    await updatePlace(currentEditId, formData); // 수정 API 호출

    Swal.fire({
      icon: 'success',
      title: '수정 완료',
      text: `'${formData.name}'이(가) 수정되었습니다.`,
      confirmButtonColor: '#2563eb',
      timer: 2000,
      timerProgressBar: true,
    });

    bootstrap.Modal.getInstance(el(mapConfigs.edit.modalId)).hide(); // 수정 모달 닫기
    loadPlaces(); // 목록 새로고침
  } catch (error) {
    Swal.fire({
      icon: 'error',
      title: '수정 실패',
      text: error.message || '수정 중 오류가 발생했습니다.',
      confirmButtonColor: '#2563eb',
    });
  }
}

// ==============================
// 삭제
// ==============================
window.confirmDelete = function (id, name) {
  Swal.fire({
    title: '맛집 삭제',
    html: `<strong>'${name}'</strong>을(를) 삭제하시겠습니까?`,
    icon: 'warning',
    showCancelButton: true,
    confirmButtonColor: '#ef4444',
    cancelButtonColor: '#64748b',
    confirmButtonText: '삭제',
    cancelButtonText: '취소',
    reverseButtons: true,
  }).then(async (result) => {
    if (!result.isConfirmed) return;

    try {
      Swal.fire({
        title: '삭제 중...',
        allowOutsideClick: false,
        didOpen: () => Swal.showLoading(),
      });

      await deletePlace(id); // 삭제 API 호출

      Swal.fire({
        icon: 'success',
        title: '삭제 완료',
        text: `'${name}'이(가) 삭제되었습니다.`,
        confirmButtonColor: '#2563eb',
        timer: 2000,
        timerProgressBar: true,
      });

      loadPlaces(); // 목록 새로고침
    } catch (error) {
      Swal.fire({
        icon: 'error',
        title: '삭제 실패',
        text: error.message || '삭제 중 오류가 발생했습니다.',
        confirmButtonColor: '#2563eb',
      });
    }
  });
};

// ==============================
// 유효성 검사
// ==============================
function validatePlaceForm(data) {
  if (!data.name) {
    showValidationError('가게 이름을 입력해주세요.');
    return false;
  }

  if (!data.address) {
    showValidationError('주소를 입력해주세요.');
    return false;
  }

  if (!data.category) {
    showValidationError('카테고리를 선택해주세요.');
    return false;
  }

  if (!data.call) {
    showValidationError('전화번호를 입력해주세요.');
    return false;
  }

  if (!data.rating || data.rating < 1 || data.rating > 5) {
    showValidationError('별점을 선택해주세요. (1~5점)');
    return false;
  }

  if (!data.lat || !data.lng) {
    showValidationError('지도에서 위치를 선택해주세요.');
    return false;
  }

  return true;
}

function showValidationError(message) {
  Swal.fire({
    icon: 'warning',
    title: '입력 확인',
    text: message,
    confirmButtonColor: '#2563eb',
  });
}