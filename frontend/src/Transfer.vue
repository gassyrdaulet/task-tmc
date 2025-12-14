<template>
  <n-card class="main-card" size="small" content-style="padding: 0px;">
    <n-layout class="main-layout" has-sider>
      <n-layout-sider width="50%" bordered class="side-pan">
        <div class="pan-header" >
          <div class="pan-title-container">
            <n-text class="pan-title">Все элементы</n-text>
            <n-text v-if="itemsTotal != null && itemsTotal >= 0" depth="3">{{ itemsTotal }} элементов</n-text>
          </div>
          <n-input v-model:value="itemsFilter" size=small placeholder="Введите ID">
            <template #suffix>
              <n-icon :component="Search32Regular" />
            </template>
          </n-input>
        </div>
        <div class="element-list-container">
          <n-infinite-scroll style="height: 500px;" :distance="10" @load="handleLoadItems">
            <div v-for="i in items" :key="i.id" class="hoverable-row clickable" @click="handleItemClick(i)">
              <n-text>
                {{ i.id }}
              </n-text>
            </div>
            <div class="list-group"></div>
            <n-empty v-if="items.length === 0 && !itemsLoading" size="large" description="Ничего нет" />
            <div v-if="itemsLoading" class="text">
              Загрузка...
            </div>
          </n-infinite-scroll>
        </div>
      </n-layout-sider>
      <n-layout-sider width="50%" bordered class="side-pan">
        <div class="pan-header" >
          <div class="pan-title-container">
            <n-text class="pan-title">Выбранные</n-text>
            <div class="right-block-of-pan-title-container">
              <n-text v-if="selectedTotal != null && selectedTotal >= 0" depth="3">Выбрано {{ selectedTotal }} элементов</n-text>
            </div>
          </div>
          <n-input v-model:value="selectedFilter" size=small placeholder="Введите ID">
            <template #suffix>
              <n-icon :component="Search32Regular" />
            </template>
          </n-input>
        </div>
        <div class="element-list-container"> 
          <n-infinite-scroll style="height: 500px;" @load="handleLoadSelected"> 
            <draggable         
              class="list-group"
              :component-data="{
                type: 'transition-group',
                name: !drag ? 'flip-list' : null
              }"
              v-model="selected" 
              v-bind="dragOptions" 
              @start="onDragStart"
              @end="onDragEnd" 
              @change="onChange"
              item-key="id"
            >
              <template #item="{element}">
                <div class="hoverable-row list-group-item"> 
                  <n-text> {{ element.id }} </n-text> 
                  <n-button quaternary size="tiny" class="remove-btn" @click="handleItemUnselect(element)"> 
                    <template #icon> 
                      <n-icon :component="Dismiss12Filled" :depth="3" /> 
                    </template>
                  </n-button> 
                </div> 
              </template>
            </draggable>
            <n-empty v-if="selected.length === 0 && !selectedLoading" size="large" description="Ничего нет" />
            <div v-if="selectedLoading" class="text">
              Загрузка...
            </div>
          </n-infinite-scroll>
        </div>
      </n-layout-sider>
    </n-layout>
  </n-card>
  <div class="add-item-block">
    <n-input v-model:value="newItemId" size=small placeholder="Новый ID"/>
    <n-button type="primary" size="small" @click="handleAddItem" :disabled="!newItemId"> 
      <template #icon> 
        <n-icon :component="AddCircle16Filled" :depth="3"/> 
      </template> 
      Добавить
    </n-button> 
  </div>
</template>

<script setup>
import { Search32Regular, Dismiss12Filled, AddCircle16Filled } from "@vicons/fluent";
import { ref, computed, onMounted, watch } from "vue";
import axios from "axios";
import { useMessage } from "naive-ui";
import draggable from "vuedraggable";

// axios.defaults.baseURL = 'http://localhost:4000';
axios.defaults.baseURL = 'https://task-tmc.onrender.com';

const message = useMessage()

const drag = ref(false);

const itemsLoading = ref(false);
const items = ref([]);
const itemsTotal = ref(undefined);
const itemsNoMore = computed(() => items.value.length >= itemsTotal.value);
const itemsFilter = ref("");
let itemsFilterTimer = null;

watch(itemsFilter, () => {
  clearTimeout(itemsFilterTimer);
  itemsFilterTimer = setTimeout(() => {
    items.value = [];
    itemsTotal.value = undefined;
    handleLoadItems(true);
  }, 300);
});

const selectedLoading = ref(false);
const selected = ref([]);
const selectedTotal = ref(undefined);
const selectedNoMore = computed(() => selected.value.length >= selectedTotal.value);
const selectedFilter = ref("");
let selectedFilterTimer = null;

watch(selectedFilter, () => {
  clearTimeout(selectedFilterTimer);
  selectedFilterTimer = setTimeout(() => {
    selected.value = [];
    selectedTotal.value = undefined;
    handleLoadSelected(true);
  }, 300);
});

const newItemId = ref("");

async function handleLoadItems(updateTotal = false) {
  if (itemsLoading.value || itemsNoMore.value) return;
  itemsLoading.value = true;
  try {
    const {data} = await axios.get('api/left?' + (new URLSearchParams({
      filter: itemsFilter.value,
      offset: items.value.length,
      limit: 20
    })).toString());
    if (updateTotal) itemsTotal.value = data.total;
    items.value.push(...data.items);
  } catch (e) {
    throw e;
  } finally {
    itemsLoading.value = false;
  }
}

async function handleLoadSelected(updateTotal = false) {
  if (selectedLoading.value || selectedNoMore.value) return;
  selectedLoading.value = true;
  try {
    const {data} = await axios.get('api/right?' + (new URLSearchParams({
      filter: selectedFilter.value,
      offset: selected.value.length,
      limit: 20
    })).toString());
    if (updateTotal) selectedTotal.value = data.total;
    selected.value.push(...data.items);
  } catch (e) {
    throw e;
  } finally {
    selectedLoading.value = false;
  }
}

async function handleItemClick(i) {
  axios.post('api/toggle-select', {
    id: i.id, 
    action: "select"
  });
  if (items.value.length < 20) await handleLoadItems();
  items.value = items.value.filter(item => item.id !== i.id);
  itemsTotal.value--;
  selectedTotal.value++;
  if (!selectedFilter.value || String(i.id).includes(selectedFilter.value)) {
    selected.value.forEach(item => {
      item.orderIndex += 1
    })
    selected.value.unshift({...i, orderIndex: 0});
  }
}

async function addItemLocally(id) {
  if (items.value.length < 20) return handleLoadItems();
  itemsTotal.value++;
  if (!itemsFilter.value || String(id).includes(itemsFilter.value)) items.value.unshift({id});
}

async function handleItemUnselect(i) {
  axios.post('api/toggle-select', {
    id: i.id, 
    action: "deselect"
  });
  if (selected.value.length < 20) await handleLoadSelected();
  selected.value = selected.value.filter(item => item.id !== i.id);
  selectedTotal.value--;
  itemsTotal.value++;
  if (!itemsFilter.value  || String(i.id).includes(itemsFilter.value)) items.value.unshift(i);
}

async function handleAddItem() {
  const newId = newItemId.value;
  message.info("Обработка нового элемента произойдет в течение 10 сек.");
  newItemId.value = "";
  axios.post('api/enqueue-add', {
    id: newId, 
  }).then(() => {
    addItemLocally(newId);
    message.success(`ID ${newId} успешно добавлен в список`);
  }).catch((e) => {
    message.error(`Ошибка добавления элемента [${newId}]:\n${e?.response?.data?.error || ""}`);
  });
}

const dragOptions = computed(() => {
  return {
    animation: 200,
    group: "description",
    disabled: false,
    ghostClass: "ghost"
  };
}) 

function onDragStart() {
  drag.value = true;
}
function onDragEnd() {
  drag.value = false;
}
function onChange({moved}){
  const {newIndex, element} = moved;
  const nextItem = selected.value[newIndex + 1];
  const prevItem = selected.value[newIndex - 1];
  const newOrderIndex = nextItem? nextItem.orderIndex : prevItem.orderIndex;
  axios.post("api/enqueue-reorder",{
    dragId: element.id,
    targetIndex: newOrderIndex,
  });
  selected.value.forEach((item, index) => {
    if (index > newIndex) item.orderIndex += 1;
  });
  selected.value[newIndex].orderIndex = newOrderIndex;
}

onMounted(() => {
  handleLoadItems(true);
  handleLoadSelected(true);
});
</script>

<style scoped>
.main-layout {
  padding: 0px;
}
.pan-header {
  padding: 0px 12px;
  margin-bottom: 10px;
}
.pan-title-container {
  padding: 0px;
  display: flex;
  justify-content: space-between;
  align-items: center;
  height: 45px;
  max-height: 45px;
  overflow: hidden;
}
.pan-title {
  font-size: 16px;
}
.right-block-of-pan-title-container {
  display: flex;
  align-items: center;
  gap: 8px;
}
.clear-selected-button {
  padding: 0px 5px;
  height: 30px;
}
.element-list-container {
  padding: 0px 5px;
}
.hoverable-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 8px 16px 8px 8px;
  border-radius: 4px;
  transition: background .2s;
}
.hoverable-row:hover {
  background: rgba(0,0,0,0.05);
}
.clickable {
  cursor: pointer;
}
.hoverable-row .remove-btn {
  opacity: 0;
  pointer-events: none;
  transition: opacity 0.15s ease-in-out;
}
.hoverable-row:hover .remove-btn {
  opacity: 1;
  pointer-events: auto;
}
.text {
  text-align: center;
  margin-bottom: 20px;
}
.add-item-block {
  display: flex;
  margin-top: 10px;
  width: 50%;
  gap: 2px;
}
.list-group {
  min-height: 20px;
}
.list-group-item {
  cursor: move;
}
.list-group-item i {
  cursor: pointer;
}
.flip-list-move {
  transition: transform 0.5s;
}
.no-move {
  transition: transform 0s;
}
.ghost {
  opacity: 0.5;
  background: #c8ebfb;
}
</style>
