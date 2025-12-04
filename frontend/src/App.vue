<template>
  <div class="app-container">
    <n-message-provider>
      <div class="transfer-wrapper">
        <Transfer/>
      </div>
    </n-message-provider>
  </div>
</template>

<script setup>
import Transfer from "./Transfer.vue";
</script>

<style>
.app-container {
  background-color: rgb(70, 70, 70);
  height: 100vh;
  padding-top: 50px;
}
.transfer-wrapper {
  background-color: rgb(255, 255, 255);
  padding: 30px;
  max-width: 1000px;
  margin: auto;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.12);
}
</style>