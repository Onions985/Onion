<script setup lang="ts">
defineProps<{ error: { statusCode: number; message: string } }>()
</script>
<template>
  <div class="setup-error">
    <OnionLogo :size="54" />
    <h1>{{ error.statusCode }}</h1>
    <p>
      {{
        error.statusCode === 404
          ? '这篇内容还没有在这里发布。 / This page is not published here.'
          : '暂时无法读取页面。 / Unable to load this page.'
      }}
    </p>
    <button class="button" @click="clearError({ redirect: '/' })">返回首页 / Go home</button>
  </div>
</template>
