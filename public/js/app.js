// ==============================
// 전역 변수
// ==============================
let places = [];
let filteredPlaces = [];
let currentEditId = null;
let currentFilter = 'all';

// 카카오맵 관련 전역 변수
let addMap = null;
let addMapMarker = null;
let kakaoPlaceService = null;
let kakaoGeocoder = null;

// ==============================
// 초기 실행
// ==============================
document.addEventListener('DOMContentLoaded', function () {
  setupEventListeners();
  initializeKakaoMap();

  // 목록 로드
  if (typeof loadPlaces === 'function') {
    loadPlaces();
  } else {
    console.error('loadPlaces 함수가 정의되지 않았습니다.');
    showEmptyState();
  }
});

// ==============================
// 이벤트 리스너 설정
// ==============================
function setupEventListeners() {
  // 등록 폼 제출
  const addPlaceForm = document.getElementById('addPlaceForm');
  if (addPlaceForm) {
    addPlaceForm.addEventListener('submit', handleAddPlace);
  }

  // 수정 폼 제출
  const editPlaceForm = document.getElementById('editPlaceForm');
  if (editPlaceForm) {
    editPlaceForm.addEventListener('submit', handleEditPlace);
  }

  // 필터 탭
  document.querySelectorAll('.filter-tab').forEach((tab) => {
    tab.addEventListener('click', function () {
      document.querySelectorAll('.filter-tab').forEach((t) => t.classList.remove('active'));
      this.classList.add('active');
      currentFilter = this.dataset.filter;
      filterPlaces();
    });
  });

  // 이름으로 장소 검색 버튼
  const searchBtn = document.getElementById('searchPlaceByNameBtn');
  if (searchBtn) {
    searchBtn.addEventListener('click', handleSearchPlaceByName);
  }

  // 등록 모달이 열릴 때 지도 보정
  const addPlaceModal = document.getElementById('addPlaceModal');
  if (addPlaceModal) {
    addPlaceModal.addEventListener('shown.bs.modal', function () {
      if (addMap && window.kakao && window.kakao.maps) {
        kakao.maps.event.trigger(addMap, 'resize');
        const center = new kakao.maps.LatLng(37.5665, 126.9780);
        addMap.setCenter(center);
      }
    });

    addPlaceModal.addEventListener('hidden.bs.modal', function () {
      if (addPlaceForm) {
        addPlaceForm.reset();
      }
      resetStarRating('add');
      clearSearchResults();
      clearAddMapSelection();
    });
  }

  // 수정 모달 닫힐 때 초기화
  const editPlaceModal = document.getElementById('editPlaceModal');
  if (editPlaceModal) {
    editPlaceModal.addEventListener('hidden.bs.modal', function () {
      if (editPlaceForm) {
        editPlaceForm.reset();
      }
      resetStarRating('edit');
      currentEditId = null;
    });
  }
}

// ==============================
// 카카오맵 초기화
// ==============================
function initializeKakaoMap() {
  if (!window.kakao || !window.kakao.maps) {
    console.error('Kakao Maps SDK가 로드되지 않았습니다.');
    return;
  }

  const mapContainer = document.getElementById('addMap');
  if (!mapContainer) {
    return;
  }

  const defaultCenter = new kakao.maps.LatLng(37.5665, 126.9780);
  const mapOption = {
    center: defaultCenter,
    level: 3,
  };

  addMap = new kakao.maps.Map(mapContainer, mapOption);

  kakaoPlaceService = new kakao.maps.services.Places();
  kakaoGeocoder = new kakao.maps.services.Geocoder();

  // 지도 클릭 시 위치 확정
  kakao.maps.event.addListener(addMap, 'click', function (mouseEvent) {
    const latLng = mouseEvent.latLng;
    setAddMapMarker(latLng);
    fillAddressByCoords(latLng);
  });
}

// ==============================
// 카카오 장소 검색
// ==============================
async function handleSearchPlaceByName() {
  const nameInput = document.getElementById('addName');
  const keyword = nameInput ? nameInput.value.trim() : '';

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

    const results = await searchPlacesByKeyword(keyword);
    Swal.close();

    if (!results.length) {
      clearSearchResults();
      showValidationError('검색 결과가 없습니다. 다른 이름으로 다시 시도해주세요.');
      return;
    }

    renderSearchResults(results);
  } catch (error) {
    Swal.fire({
      icon: 'error',
      title: '검색 실패',
      text: error.message || '장소 검색 중 오류가 발생했습니다.',
      confirmButtonColor: '#2563eb',
    });
  }
}

async function searchPlacesByKeyword(keyword) {
  return new Promise((resolve, reject) => {
    if (!kakaoPlaceService) {
      reject(new Error('카카오 장소 검색 서비스가 초기화되지 않았습니다.'));
      return;
    }

    kakaoPlaceService.keywordSearch(keyword, function (data, status) {
      if (status === kakao.maps.services.Status.OK) {
        resolve(data);
        return;
      }

      if (status === kakao.maps.services.Status.ZERO_RESULT) {
        resolve([]);
        return;
      }

      reject(new Error('장소 검색 중 오류가 발생했습니다.'));
    });
  });
}

function renderSearchResults(results) {
  const container = document.getElementById('placeSearchResult');
  if (!container) return;

  container.innerHTML = results
      .slice(0, 5)
      .map((place) => {
        const safeName = escapeHtml(place.place_name || '');
        const safeAddress = escapeHtml(place.road_address_name || place.address_name || '');
        const safePhone = escapeHtml(place.phone || '');

        // data-* 속성으로 넣고 onclick은 최소화
        return `
        <button
          type="button"
          class="w-100 text-start border rounded p-2 mb-2 bg-white"
          onclick="selectSearchResultFromButton(this)"
          data-name="${safeName}"
          data-address="${safeAddress}"
          data-phone="${safePhone}"
          data-lat="${place.y}"
          data-lng="${place.x}"
        >
          <div class="fw-semibold">${safeName}</div>
          <div class="small text-muted">${safeAddress}</div>
          <div class="small text-muted">${safePhone || '전화번호 없음'}</div>
        </button>
      `;
      })
      .join('');
}

// inline onclick 대응
window.selectSearchResultFromButton = function (buttonEl) {
  if (!buttonEl) return;

  const name = buttonEl.dataset.name || '';
  const address = buttonEl.dataset.address || '';
  const phone = buttonEl.dataset.phone || '';
  const lat = buttonEl.dataset.lat || '';
  const lng = buttonEl.dataset.lng || '';

  selectSearchResult(name, address, phone, lat, lng);
};

function selectSearchResult(name, address, phone, lat, lng) {
  if (!window.kakao || !window.kakao.maps) return;

  const latLng = new kakao.maps.LatLng(Number(lat), Number(lng));

  const addName = document.getElementById('addName');
  const addAddress = document.getElementById('addAddress');
  const addCall = document.getElementById('addCall');
  const addLat = document.getElementById('addLat');
  const addLng = document.getElementById('addLng');

  if (addName) addName.value = name;
  if (addAddress) addAddress.value = address;
  if (addCall && phone) addCall.value = phone;
  if (addLat) addLat.value = lat;
  if (addLng) addLng.value = lng;

  if (addMap) {
    addMap.setCenter(latLng);
  }

  setAddMapMarker(latLng);

  Swal.fire({
    icon: 'success',
    title: '장소 선택 완료',
    text: '지도에서 위치를 한 번 더 클릭하면 정확한 위치로 수정할 수 있습니다.',
    confirmButtonColor: '#2563eb',
    timer: 1800,
    timerProgressBar: true,
  });
}

function setAddMapMarker(latLng) {
  if (!addMap) return;

  if (!addMapMarker) {
    addMapMarker = new kakao.maps.Marker({
      position: latLng,
    });
  }

  addMapMarker.setPosition(latLng);
  addMapMarker.setMap(addMap);

  const addLat = document.getElementById('addLat');
  const addLng = document.getElementById('addLng');

  if (addLat) addLat.value = String(latLng.getLat());
  if (addLng) addLng.value = String(latLng.getLng());
}

async function fillAddressByCoords(latLng) {
  try {
    const address = await getAddressFromCoords(latLng.getLng(), latLng.getLat());
    const addAddress = document.getElementById('addAddress');

    if (address && addAddress) {
      addAddress.value = address;
    }
  } catch (error) {
    console.error('주소 변환 실패:', error);
  }
}

async function getAddressFromCoords(lng, lat) {
  return new Promise((resolve, reject) => {
    if (!kakaoGeocoder) {
      reject(new Error('카카오 지오코더가 초기화되지 않았습니다.'));
      return;
    }

    kakaoGeocoder.coord2Address(lng, lat, function (result, status) {
      if (status !== kakao.maps.services.Status.OK) {
        reject(new Error('좌표를 주소로 변환하지 못했습니다.'));
        return;
      }

      const first = result && result[0] ? result[0] : null;
      if (!first) {
        resolve('');
        return;
      }

      const roadAddress = first.road_address ? first.road_address.address_name : '';
      const jibunAddress = first.address ? first.address.address_name : '';

      resolve(roadAddress || jibunAddress || '');
    });
  });
}

function clearSearchResults() {
  const container = document.getElementById('placeSearchResult');
  if (!container) return;

  container.innerHTML = `
    <div class="text-muted small">가게 이름으로 검색하면 결과가 여기에 표시됩니다.</div>
  `;
}

function clearAddMapSelection() {
  const addLat = document.getElementById('addLat');
  const addLng = document.getElementById('addLng');

  if (addLat) addLat.value = '';
  if (addLng) addLng.value = '';

  if (addMapMarker) {
    addMapMarker.setMap(null);
    addMapMarker = null;
  }

  if (addMap && window.kakao && window.kakao.maps) {
    const defaultCenter = new kakao.maps.LatLng(37.5665, 126.9780);
    addMap.setCenter(defaultCenter);
  }
}

// ==============================
// 공통 UI 유틸
// ==============================
function resetStarRating(formType) {
  const stars = document.querySelectorAll(`#${formType}PlaceForm .star-rating-input input`);
  stars.forEach((star) => {
    star.checked = false;
  });
}

function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text == null ? '' : String(text);
  return div.innerHTML;
}

function showValidationError(message) {
  Swal.fire({
    icon: 'warning',
    title: '입력 확인',
    text: message,
    confirmButtonColor: '#2563eb',
  });
}

function showLoading() {
  const container = document.getElementById('placesContainer');
  if (!container) return;

  container.innerHTML = `
    <div class="loading-container">
      <div class="spinner"></div>
      <span class="loading-text">맛집 목록을 불러오는 중...</span>
    </div>
  `;
}

function showEmptyState() {
  const container = document.getElementById('placesContainer');
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

  const countEl = document.getElementById('displayCount');
  if (countEl) {
    countEl.textContent = '0';
  }
}

// ==============================
// 목록 조회 / 필터링 / 렌더링
// ==============================
async function loadPlaces() {
  showLoading();

  try {
    const result = await getAllPlaces();

    if (!Array.isArray(result) || result.length === 0) {
      places = [];
      filteredPlaces = [];
      showEmptyState();
      return;
    }

    places = result;
    filterPlaces();
  } catch (error) {
    console.error('맛집 목록 로드 실패:', error);
    places = [];
    filteredPlaces = [];
    showEmptyState();
  }
}

function filterPlaces() {
  if (!Array.isArray(places) || places.length === 0) {
    filteredPlaces = [];
    showEmptyState();
    return;
  }

  if (currentFilter === 'all') {
    filteredPlaces = [...places];
  } else {
    filteredPlaces = places.filter((p) => p.category === currentFilter);
  }

  renderPlaces();
  updateCount();
}

function updateCount() {
  const displayCount = document.getElementById('displayCount');
  if (!displayCount) return;

  displayCount.textContent = String(filteredPlaces.length);
}

function renderPlaces() {
  const container = document.getElementById('placesContainer');
  if (!container) return;

  if (!filteredPlaces.length) {
    showEmptyState();
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
            <button class="btn-card btn-edit" onclick="openEditModal('${escapeHtml(place.id)}')">
              <i class="fas fa-pen"></i>
              수정
            </button>
            <button class="btn-card btn-delete" onclick="confirmDelete('${escapeHtml(place.id)}', '${escapeHtml(place.name)}')">
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
  const safeRating = Number(rating || 0);
  let stars = '';

  for (let i = 1; i <= 5; i++) {
    if (i <= safeRating) {
      stars += '<i class="fas fa-star"></i>';
    } else {
      stars += '<i class="fas fa-star empty"></i>';
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
  };

  return categoryMap[category] || 'category-etc';
}

// ==============================
// 등록
// ==============================
async function handleAddPlace(e) {
  e.preventDefault();

  const formData = {
    name: document.getElementById('addName')?.value.trim() || '',
    address: document.getElementById('addAddress')?.value.trim() || '',
    category: document.getElementById('addCategory')?.value || '',
    call: document.getElementById('addCall')?.value.trim() || '',
    rating: parseInt(document.querySelector('input[name="addRating"]:checked')?.value || 0, 10),
    lat: document.getElementById('addLat')?.value.trim() || '',
    lng: document.getElementById('addLng')?.value.trim() || '',
  };

  if (!validateAddForm(formData)) return;

  try {
    Swal.fire({
      title: '등록 중...',
      allowOutsideClick: false,
      didOpen: () => Swal.showLoading(),
    });

    await createPlace(formData);

    Swal.fire({
      icon: 'success',
      title: '등록 완료',
      text: `'${formData.name}'이(가) 등록되었습니다.`,
      confirmButtonColor: '#2563eb',
      timer: 2000,
      timerProgressBar: true,
    });

    const modalEl = document.getElementById('addPlaceModal');
    const modalInstance = modalEl ? bootstrap.Modal.getInstance(modalEl) : null;
    if (modalInstance) {
      modalInstance.hide();
    }

    loadPlaces();
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
  const place = places.find((p) => String(p.id) === String(id));
  if (!place) return;

  currentEditId = id;

  const editName = document.getElementById('editName');
  const editAddress = document.getElementById('editAddress');
  const editCategory = document.getElementById('editCategory');
  const editCall = document.getElementById('editCall');

  if (editName) editName.value = place.name || '';
  if (editAddress) editAddress.value = place.address || '';
  if (editCategory) editCategory.value = place.category || '';
  if (editCall) editCall.value = place.call || '';

  const ratingInput = document.querySelector(`input[name="editRating"][value="${place.rating}"]`);
  if (ratingInput) {
    ratingInput.checked = true;
  }

  new bootstrap.Modal(document.getElementById('editPlaceModal')).show();
};

async function handleEditPlace(e) {
  e.preventDefault();

  const formData = {
    name: document.getElementById('editName')?.value.trim() || '',
    address: document.getElementById('editAddress')?.value.trim() || '',
    category: document.getElementById('editCategory')?.value || '',
    call: document.getElementById('editCall')?.value.trim() || '',
    rating: parseInt(document.querySelector('input[name="editRating"]:checked')?.value || 0, 10),
  };

  if (!validateEditForm(formData)) return;

  try {
    Swal.fire({
      title: '수정 중...',
      allowOutsideClick: false,
      didOpen: () => Swal.showLoading(),
    });

    await updatePlace(currentEditId, formData);

    Swal.fire({
      icon: 'success',
      title: '수정 완료',
      text: `'${formData.name}'이(가) 수정되었습니다.`,
      confirmButtonColor: '#2563eb',
      timer: 2000,
      timerProgressBar: true,
    });

    const modalEl = document.getElementById('editPlaceModal');
    const modalInstance = modalEl ? bootstrap.Modal.getInstance(modalEl) : null;
    if (modalInstance) {
      modalInstance.hide();
    }

    loadPlaces();
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

      await deletePlace(id);

      Swal.fire({
        icon: 'success',
        title: '삭제 완료',
        text: `'${name}'이(가) 삭제되었습니다.`,
        confirmButtonColor: '#2563eb',
        timer: 2000,
        timerProgressBar: true,
      });

      loadPlaces();
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
function validateAddForm(data) {
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

function validateEditForm(data) {
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

  return true;
}