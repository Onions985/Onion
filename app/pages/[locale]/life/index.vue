<script setup lang="ts">
definePageMeta({ validate: (route) => ['zh', 'en'].includes(String(route.params.locale)) })
</script>
<template><ContentList kind="life" /></template>
