// 전역 변수
let places = [];
let filteredPlaces = [];
let currentEditId = null;
let currentFilter = 'all';

// 카카오맵 관련 전역 변수
let addMap = null; // 등록 모달용 지도 객체
let addMapMarker = null; // 등록 모달용 마커
let kakaoPlaceService = null; // 장소 검색 서비스
let kakaoGeocoder = null; // 좌표-주소 변환 서비스

// DOM 로드 완료 시 실행
document.addEventListener('DOMContentLoaded', function () {
  loadPlaces(); // 기존 목록 조회
  setupEventListeners(); // 기존 이벤트 등록
  initializeKakaoMap(); // 카카오맵 초기화 추가
});

// 이벤트 리스너 설정
function setupEventListeners() {
  // 등록 폼 제출
  document.getElementById('addPlaceForm').addEventListener('submit', handleAddPlace);

  // 수정 폼 제출
  document.getElementById('editPlaceForm').addEventListener('submit', handleEditPlace);

  // 필터 탭
  document.querySelectorAll('.filter-tab').forEach(tab => {
    tab.addEventListener('click', function() {
      document.querySelectorAll('.filter-tab').forEach(t => t.classList.remove('active'));
      this.classList.add('active');
      currentFilter = this.dataset.filter;
      filterPlaces();
    });
  });

  // 카카오맵 초기화
function initializeKakaoMap() {
  if (!window.kakao || !window.kakao.maps) {
    console.error('Kakao Maps SDK가 로드되지 않았습니다.');
    return;
  }

  const mapContainer = document.getElementById('addMap'); // 지도를 그릴 div
  if (!mapContainer) return; // 안전 처리

  const defaultCenter = new kakao.maps.LatLng(37.5665, 126.9780); // 서울 시청 기본 좌표
  const mapOption = {
    center: defaultCenter, // 초기 중심 좌표
    level: 3, // 확대 레벨
  };

  addMap = new kakao.maps.Map(mapContainer, mapOption); // 지도 생성
  addMapMarker = new kakao.maps.Marker({
    position: defaultCenter, // 초기 마커 위치
  });

  kakaoPlaceService = new kakao.maps.services.Places(); // 장소 검색 객체 생성
  kakaoGeocoder = new kakao.maps.services.Geocoder(); // 주소 변환 객체 생성

  // 지도 클릭 시 위치 확정
  kakao.maps.event.addListener(addMap, 'click', function (mouseEvent) {
    const latLng = mouseEvent.latLng; // 클릭 좌표 추출
    setAddMapMarker(latLng); // 마커 이동
    fillAddressByCoords(latLng); // 좌표 -> 주소 반영
  });
}

// 가게 이름으로 장소 검색 처리
async function handleSearchPlaceByName() {
  const keyword = document.getElementById('addName').value.trim(); // 이름 입력값 추출

  if (!keyword) {
    showValidationError('먼저 가게 이름을 입력해주세요.'); // 빈 값 방지
    return;
  }

  try {
    Swal.fire({
      title: '장소 검색 중...',
      allowOutsideClick: false,
      didOpen: () => Swal.showLoading(),
    });

    const results = await searchPlacesByKeyword(keyword); // 키워드 검색 실행

    Swal.close(); // 로딩 닫기

    if (!results.length) {
      showValidationError('검색 결과가 없습니다. 다른 이름으로 다시 시도해주세요.');
      clearSearchResults();
      return;
    }

    renderSearchResults(results); // 결과 목록 렌더링
  } catch (error) {
    Swal.fire({
      icon: 'error',
      title: '검색 실패',
      text: error.message,
      confirmButtonColor: '#2563eb',
    });
  }
}

// 카카오 장소명 검색
async function searchPlacesByKeyword(keyword) {
  return new Promise((resolve, reject) => {
    if (!kakaoPlaceService) {
      reject(new Error('카카오 장소 검색 서비스가 초기화되지 않았습니다.'));
      return;
    }

    kakaoPlaceService.keywordSearch(keyword, function (data, status) {
      if (status === kakao.maps.services.Status.OK) {
        resolve(data); // 정상 결과 반환
        return;
      }

      if (status === kakao.maps.services.Status.ZERO_RESULT) {
        resolve([]); // 결과 없음
        return;
      }

      reject(new Error('장소 검색 중 오류가 발생했습니다.')); // 기타 오류
    });
  });
}

// 검색 결과 목록 렌더링
function renderSearchResults(results) {
  const container = document.getElementById('placeSearchResult'); // 결과 컨테이너 찾기

  container.innerHTML = results
    .slice(0, 5) // 상위 5개만 표시
    .map((place) => {
      const safeName = escapeHtml(place.place_name || ''); // XSS 방지용 이름
      const safeAddress = escapeHtml(place.road_address_name || place.address_name || ''); // 도로명 우선
      const safePhone = escapeHtml(place.phone || '전화번호 없음'); // 전화번호 없을 때 처리

      return `
        <button 
          type="button"
          class="w-100 text-start border rounded p-2 mb-2 bg-white hover:bg-gray-50"
          onclick="selectSearchResult('${escapeHtml(place.place_name || '')}', '${escapeHtml(place.road_address_name || place.address_name || '')}', '${escapeHtml(place.phone || '')}', '${place.y}', '${place.x}')"
        >
          <div class="fw-semibold">${safeName}</div>
          <div class="small text-muted">${safeAddress}</div>
          <div class="small text-muted">${safePhone}</div>
        </button>
      `;
    })
    .join('');
}

// 검색 결과 선택
function selectSearchResult(name, address, phone, lat, lng) {
  const latLng = new kakao.maps.LatLng(Number(lat), Number(lng)); // 좌표 객체 생성

  document.getElementById('addName').value = name; // 이름 자동 입력
  document.getElementById('addAddress').value = address; // 주소 자동 입력

  if (phone) {
    document.getElementById('addCall').value = phone; // 전화번호 있으면 자동 입력
  }

  document.getElementById('addLat').value = lat; // 숨김 위도 저장
  document.getElementById('addLng').value = lng; // 숨김 경도 저장

  addMap.setCenter(latLng); // 지도 중심 이동
  setAddMapMarker(latLng); // 마커 이동

  Swal.fire({
    icon: 'success',
    title: '장소 선택 완료',
    text: '지도에서 위치를 한 번 더 클릭하면 정확한 위치로 수정할 수 있습니다.',
    confirmButtonColor: '#2563eb',
    timer: 1800,
    timerProgressBar: true,
  });
}

// 등록 지도 마커 설정
function setAddMapMarker(latLng) {
  if (!addMapMarker) {
    addMapMarker = new kakao.maps.Marker({
      position: latLng,
    });
  }

  addMapMarker.setPosition(latLng); // 마커 좌표 변경
  addMapMarker.setMap(addMap); // 지도에 표시

  document.getElementById('addLat').value = latLng.getLat(); // 위도 저장
  document.getElementById('addLng').value = latLng.getLng(); // 경도 저장
}

// 좌표로 주소 채우기
async function fillAddressByCoords(latLng) {
  try {
    const address = await getAddressFromCoords(latLng.getLng(), latLng.getLat()); // 경도, 위도 기준 변환

    if (address) {
      document.getElementById('addAddress').value = address; // 주소 자동 반영
    }
  } catch (error) {
    console.error('주소 변환 실패:', error);
  }
}

// 좌표 -> 주소 변환
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

      const first = result[0]; // 첫 번째 결과 사용
      const roadAddress = first.road_address?.address_name || ''; // 도로명 주소 우선
      const jibunAddress = first.address?.address_name || ''; // 지번 주소 대체

      resolve(roadAddress || jibunAddress || ''); // 사용할 주소 결정
    });
  });
}

// 검색 결과 초기화
function clearSearchResults() {
  const container = document.getElementById('placeSearchResult');
  container.innerHTML = `
    <div class="text-muted small">가게 이름으로 검색하면 결과가 여기에 표시됩니다.</div>
  `;
}

// 등록 지도 선택값 초기화
function clearAddMapSelection() {
  document.getElementById('addLat').value = ''; // 위도 초기화
  document.getElementById('addLng').value = ''; // 경도 초기화

  if (addMapMarker) {
    addMapMarker.setMap(null); // 기존 마커 제거
  }

  const defaultCenter = new kakao.maps.LatLng(37.5665, 126.9780); // 기본 위치
  if (addMap) {
    addMap.setCenter(defaultCenter); // 지도 중심 복원
  }
}


  // 모달 닫힐 때 폼 초기화
    document.getElementById('addPlaceModal').addEventListener('hidden.bs.modal', function () {
    document.getElementById('addPlaceForm').reset(); // 폼 초기화
    resetStarRating('add'); // 별점 초기화
    clearSearchResults(); // 검색 결과 목록 초기화
    clearAddMapSelection(); // 지도 선택값 초기화
  });

  document.getElementById('editPlaceModal').addEventListener('hidden.bs.modal', function () {
    document.getElementById('editPlaceForm').reset();
    resetStarRating('edit');
    currentEditId = null;
  });
}

  // 가게 이름으로 장소 검색
  document.getElementById('searchPlaceByNameBtn').addEventListener('click', handleSearchPlaceByName);

  // 등록 모달이 열릴 때 지도 리사이즈 보정
  document.getElementById('addPlaceModal').addEventListener('shown.bs.modal', function () {
    if (addMap) {
      kakao.maps.event.trigger(addMap, 'resize');
      const center = new kakao.maps.LatLng(37.5665, 126.9780); // 서울 시청 기본값
      addMap.setCenter(center);
    }
  });

// 별점 초기화
function resetStarRating(formType) {
  const stars = document.querySelectorAll(`#${formType}PlaceForm .star-rating-input input`);
  stars.forEach((star) => (star.checked = false));
}

// 맛집 목록 로드
async function loadPlaces() {
  showLoading();
  try {
    places = await getAllPlaces();
    filterPlaces();
  } catch (error) {
    Swal.fire({
      icon: 'error',
      title: '오류 발생',
      text: '맛집 목록을 불러오는데 실패했습니다.',
      confirmButtonColor: '#2563eb',
    });
  }
}

// 필터링
function filterPlaces() {
  if (currentFilter === 'all') {
    filteredPlaces = [...places];
  } else {
    filteredPlaces = places.filter(p => p.category === currentFilter);
  }
  renderPlaces();
  updateCount();
}

// 개수 업데이트
function updateCount() {
  document.getElementById('displayCount').textContent = filteredPlaces.length;
}

// 로딩 표시
function showLoading() {
  const container = document.getElementById('placesContainer');
  container.innerHTML = `
    <div class="loading-container">
      <div class="spinner"></div>
      <span class="loading-text">맛집 목록을 불러오는 중...</span>
    </div>
  `;
}

// 맛집 목록 렌더링
function renderPlaces() {
  const container = document.getElementById('placesContainer');

  if (filteredPlaces.length === 0) {
    container.innerHTML = `
      <div class="empty-state">
        <div class="empty-icon">
          <i class="fas fa-utensils"></i>
        </div>
        <h3 class="empty-title">등록된 맛집이 없습니다</h3>
        <p class="empty-desc">새로운 맛집을 등록해보세요!</p>
      </div>
    `;
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
            <span class="rating-number">${place.rating}.0</span>
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
          <button class="btn-card btn-edit" onclick="openEditModal(${place.id})">
            <i class="fas fa-pen"></i>
            수정
          </button>
          <button class="btn-card btn-delete" onclick="confirmDelete(${place.id}, '${escapeHtml(place.name)}')">
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

// 별점 렌더링
function renderStars(rating) {
  let stars = '';
  for (let i = 1; i <= 5; i++) {
    if (i <= rating) {
      stars += '<i class="fas fa-star"></i>';
    } else {
      stars += '<i class="fas fa-star empty"></i>';
    }
  }
  return stars;
}

// 카테고리 클래스 반환
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

// HTML 이스케이프
function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

// 맛집 등록 처리
async function handleAddPlace(e) {
  e.preventDefault();

  const formData = {
    name: document.getElementById('addName').value.trim(), // 가게 이름
    address: document.getElementById('addAddress').value.trim(), // 주소
    category: document.getElementById('addCategory').value, // 카테고리
    call: document.getElementById('addCall').value.trim(), // 전화번호
    rating: parseInt(document.querySelector('input[name="addRating"]:checked')?.value || 0), // 별점
    lat: document.getElementById('addLat').value.trim(), // 위도 추가
    lng: document.getElementById('addLng').value.trim(), // 경도 추가
};

  if (!validateForm(formData)) return;

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

    bootstrap.Modal.getInstance(document.getElementById('addPlaceModal')).hide();
    loadPlaces();
  } catch (error) {
    Swal.fire({
      icon: 'error',
      title: '등록 실패',
      text: error.message,
      confirmButtonColor: '#2563eb',
    });
  }
}

// 수정 모달 열기
function openEditModal(id) {
  const place = places.find((p) => p.id == id);
  if (!place) return;

  currentEditId = id;

  document.getElementById('editName').value = place.name;
  document.getElementById('editAddress').value = place.address;
  document.getElementById('editCategory').value = place.category;
  document.getElementById('editCall').value = place.call;

  const ratingInput = document.querySelector(`input[name="editRating"][value="${place.rating}"]`);
  if (ratingInput) ratingInput.checked = true;

  new bootstrap.Modal(document.getElementById('editPlaceModal')).show();
}

// 맛집 수정 처리
async function handleEditPlace(e) {
  e.preventDefault();

  const formData = {
    name: document.getElementById('editName').value.trim(),
    address: document.getElementById('editAddress').value.trim(),
    category: document.getElementById('editCategory').value,
    call: document.getElementById('editCall').value.trim(),
    rating: parseInt(document.querySelector('input[name="editRating"]:checked')?.value || 0),
  };

  if (!validateForm(formData)) return;

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

    bootstrap.Modal.getInstance(document.getElementById('editPlaceModal')).hide();
    loadPlaces();
  } catch (error) {
    Swal.fire({
      icon: 'error',
      title: '수정 실패',
      text: error.message,
      confirmButtonColor: '#2563eb',
    });
  }
}

// 삭제 확인
function confirmDelete(id, name) {
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
    if (result.isConfirmed) {
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
          text: error.message,
          confirmButtonColor: '#2563eb',
        });
      }
    }
  });
}

// 폼 유효성 검사
function validateForm(data) {
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

// 유효성 검사 에러 표시
function showValidationError(message) {
  Swal.fire({
    icon: 'warning',
    title: '입력 확인',
    text: message,
    confirmButtonColor: '#2563eb',
  });
}
