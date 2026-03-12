// MockAPI Base URL
const BASE_URL = 'https://69afc0a0c63dd197feba084f.mockapi.io';

// 맛집 전체 조회
async function getAllPlaces() {
  try {
    const response = await fetch(`${BASE_URL}/places`);
    if (!response.ok) {
      throw new Error('맛집 목록을 불러오는데 실패했습니다.');
    }
    return await response.json();
  } catch (error) {
    console.error('GET Error:', error);
    throw error;
  }
}

// 맛집 등록
async function createPlace(placeData) {
  try {
    const response = await fetch(`${BASE_URL}/places`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(placeData),
    });
    if (!response.ok) {
      throw new Error('맛집 등록에 실패했습니다.');
    }
    return await response.json();
  } catch (error) {
    console.error('POST Error:', error);
    throw error;
  }
}

// 맛집 수정
async function updatePlace(id, placeData) {
  try {
    const response = await fetch(`${BASE_URL}/places/${id}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(placeData),
    });
    if (!response.ok) {
      throw new Error('맛집 수정에 실패했습니다.');
    }
    return await response.json();
  } catch (error) {
    console.error('PUT Error:', error);
    throw error;
  }
}

// 맛집 삭제
async function deletePlace(id) {
  try {
    const response = await fetch(`${BASE_URL}/places/${id}`, {
      method: 'DELETE',
    });
    if (!response.ok) {
      throw new Error('맛집 삭제에 실패했습니다.');
    }
    return await response.json();
  } catch (error) {
    console.error('DELETE Error:', error);
    throw error;
  }
}
